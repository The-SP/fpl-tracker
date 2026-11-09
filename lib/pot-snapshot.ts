import {
  fetchBootstrap,
  fetchEntryHistories,
  fetchEntrySummary,
  getGameweekPointsFromHistory,
  getChipForGameweek,
  type BootstrapData,
  type EntryHistory,
} from "./fpl";
import { resolvePotRoster } from "./pot-roster";
import { POT_LATE_JOINERS } from "@/config/pot";
import { initializeDatabase } from "./db";
import { competitionRank } from "./ranking";
import {
  getPotMembers,
  getStoredPotResultStatus,
  seedPotMembersIfEmpty,
  upsertPotLateJoiners,
  recalculatePotRankings,
  storePotResults,
  updatePotMemberNames,
  type PotGwResult,
  type PotMember,
} from "./pot-db";

/**
 * Gameweeks worth snapshotting, mapped to whether FPL has finalized them.
 * Finished and data-checked gameweeks are final; the current gameweek and
 * finished ones still awaiting FPL's data check are provisional. Future
 * gameweeks are skipped.
 */
export function getPotGameweekStatuses(bootstrap: BootstrapData): Map<number, boolean> {
  const gameweeks = new Map<number, boolean>();
  for (const event of bootstrap.events) {
    if (event.finished && event.data_checked) gameweeks.set(event.id, true);
    else if (event.finished || event.is_current) gameweeks.set(event.id, false);
  }
  return gameweeks;
}

/**
 * Build one gameweek's ranked results for the active roster.
 * Ranking uses FPL's `points` field directly, which is already net of
 * transfer-cost hits. Ties share the same rank and are all marked as winners
 * (prize split evenly at read time). Members whose history could not be
 * fetched are returned in `missingIds`. Members who join the pot after this
 * gameweek are left out.
 */
export function buildPotGameweekResults(
  gw: number,
  isFinal: boolean,
  members: PotMember[],
  histories: Map<number, EntryHistory>,
): { results: PotGwResult[]; missingIds: number[] } {
  const missingIds: number[] = [];
  const rows: Omit<PotGwResult, "rank" | "is_winner">[] = [];

  for (const member of members) {
    if (!member.active || gw < member.joined_gw) continue;

    const history = histories.get(member.entry_id);
    if (!history) {
      missingIds.push(member.entry_id);
      continue;
    }

    const gwPoints = getGameweekPointsFromHistory(history, gw);
    if (!gwPoints) continue;

    rows.push({
      gw,
      entry_id: member.entry_id,
      entry_name: member.entry_name,
      player_name: member.player_name,
      points: gwPoints.points,
      chip: getChipForGameweek(history, gw),
      is_final: isFinal,
    });
  }

  const results = competitionRank(rows, (row) => row.points).map(({ item, rank }) => ({
    ...item,
    rank,
    is_winner: rank === 1,
  }));

  return { results, missingIds };
}

/**
 * Whether stored results for a gameweek are complete and final, so the
 * gameweek can be skipped. Members whose history failed to load are expected
 * to already have a final row; members without a row for this gameweek in
 * their history (for example, they joined later) are not expected at all.
 */
function isGameweekUpToDate(
  gw: number,
  isFinal: boolean,
  members: PotMember[],
  histories: Map<number, EntryHistory>,
  stored: Map<number, boolean> | undefined,
): boolean {
  if (!isFinal || !stored) return false;

  return members
    .filter((member) => member.active && gw >= member.joined_gw)
    .filter((member) => {
      const history = histories.get(member.entry_id);
      return !history || getGameweekPointsFromHistory(history, gw) !== null;
    })
    .every((member) => stored.get(member.entry_id) === true);
}

async function repairMissingMemberNames(members: PotMember[]): Promise<void> {
  // Older seeded rosters may have NULL manager names. Repair those entries
  // from the authoritative FPL profile.
  for (const member of members) {
    if (member.player_name && member.entry_name) continue;
    try {
      const summary = await fetchEntrySummary(member.entry_id);
      await updatePotMemberNames(
        member.entry_id,
        summary.name,
        `${summary.player_first_name} ${summary.player_last_name}`,
      );
    } catch (error) {
      console.error(`Pot: failed to repair names for entry ${member.entry_id}`, error);
    }
  }
}

/**
 * Snapshot every started gameweek for the pot roster. Throws after processing
 * if any manager history could not be fetched, so the run is not recorded as
 * successful and stays retryable.
 */
export async function runPotSnapshotJob(): Promise<void> {
  await initializeDatabase();

  let members = await getPotMembers();
  if (members.length === 0) {
    console.log("Pot: no roster yet, resolving from source league...");
    const roster = await resolvePotRoster();
    await seedPotMembersIfEmpty(roster);
    members = await getPotMembers();
  }

  // Late joiners are added to an established roster explicitly from config.
  const lateJoiners = POT_LATE_JOINERS.filter(
    (j) => members.find((m) => m.entry_id === j.entryId)?.joined_gw !== j.fromGw,
  );
  if (lateJoiners.length > 0) {
    await upsertPotLateJoiners(
      lateJoiners.map((j) => ({ entry_id: j.entryId, joined_gw: j.fromGw })),
    );
    members = await getPotMembers();
  }

  await repairMissingMemberNames(members);
  members = await getPotMembers();

  // Fetch each manager history once and reuse it for every gameweek.
  const [bootstrap, { histories, failedIds }, storedStatus] = await Promise.all([
    fetchBootstrap(),
    fetchEntryHistories(members.filter((m) => m.active).map((m) => m.entry_id)),
    getStoredPotResultStatus(),
  ]);

  for (const [gw, isFinal] of getPotGameweekStatuses(bootstrap)) {
    if (isGameweekUpToDate(gw, isFinal, members, histories, storedStatus.get(gw))) {
      continue;
    }

    const { results, missingIds } = buildPotGameweekResults(gw, isFinal, members, histories);

    // A final gameweek must include every member, or the stored winner could
    // be wrong. Leave it for the next run. Provisional gameweeks are still
    // written, since they are excluded from balances.
    if (isFinal && missingIds.length > 0) {
      console.warn(`Pot: skipping final GW ${gw}, missing histories for ${missingIds.join(", ")}`);
      continue;
    }
    if (results.length === 0) continue;

    await storePotResults(results);
    console.log(
      `Pot: GW ${gw} snapshotted (${results.length} members, top score ${results[0].points}${isFinal ? "" : ", provisional"})`,
    );
  }

  // Keep ranks consistent across all stored rows, including any left over
  // from members who are no longer active.
  await recalculatePotRankings();

  if (failedIds.length > 0) {
    throw new Error(`Failed to fetch history for entries ${failedIds.join(", ")}`);
  }
}
