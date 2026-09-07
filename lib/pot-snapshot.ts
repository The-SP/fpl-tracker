import {
  fetchBootstrap,
  fetchEntryHistory,
  getGameweekPointsFromHistory,
  getChipForGameweek,
} from "./fpl";
import { resolvePotRoster } from "./pot-roster";
import { fetchEntrySummary } from "./fpl";
import { initializeDatabase } from "./db";
import {
  getPotMembers,
  seedPotMembersIfEmpty,
  potResultExists,
  storePotResult,
  updatePotMemberNames,
  type PotGwResult,
} from "./pot-db";

export async function getFinalizedGameweeksForPot(): Promise<number[]> {
  const bootstrap = await fetchBootstrap();
  return bootstrap.events
    .filter((e) => e.finished && e.data_checked)
    .map((e) => e.id);
}

interface ResultRow {
  entry_id: number;
  entry_name: string;
  player_name: string;
  points: number;
  chip: string | null;
  rank: number;
}

/**
 * Snapshot a single gameweek for the whole pot roster.
 * Ranking uses FPL's `points` field directly — already net of transfer-cost
 * hits, so no separate deduction step is needed. Ties share the same rank
 * and are all marked as winners (prize split evenly at read time).
 */
export async function snapshotPotGameweek(
  gw: number,
  histories?: Map<number, Awaited<ReturnType<typeof fetchEntryHistory>>>,
): Promise<void> {
  const members = await getPotMembers();

  const rows: Omit<ResultRow, "rank">[] = [];

  for (const member of members) {
    if (!member.active) continue;

    try {
      const history = histories?.get(member.entry_id) ?? await fetchEntryHistory(member.entry_id);
      const gwPoints = getGameweekPointsFromHistory(history, gw);
      if (!gwPoints) continue;

      rows.push({
        entry_id: member.entry_id,
        entry_name: member.entry_name,
        player_name: member.player_name,
        points: gwPoints.points,
        chip: getChipForGameweek(history, gw),
      });
    } catch (error) {
      console.error(`Pot: failed to fetch history for entry ${member.entry_id}`, error);
    }
  }

  if (rows.length === 0) return;

  rows.sort((a, b) => b.points - a.points);

  // Standard competition ranking: ties share a rank (e.g. 1, 1, 3)
  const ranked: ResultRow[] = rows.map((row) => ({ ...row, rank: 0 }));
  let currentRank = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i - 1].points !== ranked[i].points) {
      currentRank = i + 1;
    }
    ranked[i].rank = currentRank;
  }

  const topScore = ranked[0].points;

  for (const row of ranked) {
    const result: PotGwResult = {
      gw,
      entry_id: row.entry_id,
      entry_name: row.entry_name,
      player_name: row.player_name,
      points: row.points,
      rank: row.rank,
      is_winner: row.points === topScore,
      chip: row.chip,
    };
    await storePotResult(result);
  }

  console.log(`Pot: GW ${gw} snapshotted (${ranked.length} members, top score ${topScore})`);
}

export async function runPotSnapshotJob(): Promise<void> {
  await initializeDatabase();

  let members = await getPotMembers();
  if (members.length === 0) {
    console.log("Pot: no roster yet, resolving from source league...");
    const roster = await resolvePotRoster();
    await seedPotMembersIfEmpty(roster);
    members = await getPotMembers();
  }

  // Older seeded rosters may have NULL manager names. Repair those entries
  // and their already-snapshotted results from the authoritative FPL profile.
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

  members = await getPotMembers();

  // Fetch each manager history once. The previous implementation fetched the
  // same history again for every finalized gameweek, which commonly exceeded
  // Vercel's serverless function timeout.
  const historyResults = await Promise.allSettled(
    members.filter((member) => member.active).map(async (member) => ({
      entryId: member.entry_id,
      history: await fetchEntryHistory(member.entry_id),
    }))
  );
  const histories = new Map<number, Awaited<ReturnType<typeof fetchEntryHistory>>>();
  for (const result of historyResults) {
    if (result.status === "fulfilled") {
      histories.set(result.value.entryId, result.value.history);
    } else {
      console.error("Pot: failed to fetch a manager history", result.reason);
    }
  }

  const finalizedGws = await getFinalizedGameweeksForPot();

  for (const gw of finalizedGws) {
    const statuses = await Promise.all(
      members.map((m) => potResultExists(gw, m.entry_id))
    );
    const allDone = statuses.every(Boolean);
    if (allDone) continue;

    await snapshotPotGameweek(gw, histories);
  }
}
