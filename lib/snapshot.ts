import {
  fetchBootstrap,
  fetchLeagueStandings,
  fetchEntryHistories,
  getGameweekPointsFromHistory,
  type EntryHistory,
  type StandingsEntry,
} from "./fpl";
import {
  storeSnapshot,
  getSnapshotKeys,
  initializeDatabase,
  type GWSnapshot,
  type Top5Manager,
} from "./db";
import { TRACKED_LEAGUES, USER_ENTRY_ID } from "@/config/leagues";

/**
 * Finalized gameweeks that have no stored snapshot yet, grouped by league.
 */
export async function getGameweeksToSnapshot(): Promise<Map<number, number[]>> {
  const [bootstrap, existing] = await Promise.all([fetchBootstrap(), getSnapshotKeys()]);
  const finalizedGws = bootstrap.events
    .filter((event) => event.finished && event.data_checked)
    .map((event) => event.id);

  const toSnapshot = new Map<number, number[]>();
  for (const league of TRACKED_LEAGUES) {
    const gws = finalizedGws.filter((gw) => !existing.has(`${league.id}:${gw}`));
    if (gws.length > 0) toSnapshot.set(league.id, gws);
  }
  return toSnapshot;
}

/**
 * Build a league's snapshot for one gameweek from already-fetched data.
 * Returns null when the user has no result in that gameweek.
 */
export function buildLeagueSnapshot(
  leagueId: number,
  gw: number,
  standings: StandingsEntry[],
  histories: Map<number, EntryHistory>
): GWSnapshot | null {
  // Standings pages can shift while paging, so an entry may appear twice.
  const uniqueEntries = [...new Map(standings.map((s) => [s.entry, s])).values()];

  const managers = uniqueEntries.flatMap((entry) => {
    const history = histories.get(entry.entry);
    const gwPoints = history ? getGameweekPointsFromHistory(history, gw) : null;
    return gwPoints
      ? [
          {
            entry_id: entry.entry,
            name: entry.entry_name || `Entry ${entry.entry}`,
            points: gwPoints.points,
            total_points: gwPoints.total_points,
          },
        ]
      : [];
  });

  // Sort by points descending, then by total_points descending for tiebreaker
  managers.sort((a, b) => b.points - a.points || b.total_points - a.total_points);

  const userIndex = managers.findIndex((m) => m.entry_id === USER_ENTRY_ID);
  if (userIndex === -1) return null;

  const top5: Top5Manager[] = managers.slice(0, 5).map((m, index) => ({
    entry_id: m.entry_id,
    name: m.name,
    points: m.points,
    rank: index + 1,
  }));

  return {
    league_id: leagueId,
    gw,
    my_rank: userIndex + 1,
    my_points: managers[userIndex].points,
    top5,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Snapshot all missing gameweeks for one league. Every member's history is
 * fetched once and reused across gameweeks. If any history fails, nothing is
 * stored for the league: a missing manager would permanently skew the rank,
 * since stored gameweeks are never revisited.
 */
async function snapshotLeague(
  leagueId: number,
  gws: number[],
  historyCache: Map<number, EntryHistory>
): Promise<void> {
  const standings = await fetchLeagueStandings(leagueId);

  if (!standings.some((entry) => entry.entry === USER_ENTRY_ID)) {
    console.warn(`  Skipping league ${leagueId}: user entry ${USER_ENTRY_ID} is not in this league.`);
    return;
  }

  const uncached = standings.map((s) => s.entry).filter((id) => !historyCache.has(id));
  const { histories, failedIds } = await fetchEntryHistories(uncached);
  histories.forEach((history, entryId) => historyCache.set(entryId, history));

  if (failedIds.length > 0) {
    throw new Error(
      `Failed to fetch ${failedIds.length} manager histories for league ${leagueId}`
    );
  }

  for (const gw of gws) {
    const snapshot = buildLeagueSnapshot(leagueId, gw, standings, historyCache);
    if (!snapshot) {
      console.warn(`  Skipping league ${leagueId} for GW ${gw}: no result for user entry ${USER_ENTRY_ID}.`);
      continue;
    }

    await storeSnapshot(snapshot);
    console.log(`  ✓ GW ${gw} stored: rank ${snapshot.my_rank}, points ${snapshot.my_points}`);
  }
}

/**
 * Run the full snapshot job for all finalized gameweeks. Leagues are processed
 * independently; if any league fails, the job throws after the others finish
 * so the run is not recorded as successful and stays retryable.
 */
export async function runSnapshotJob(): Promise<void> {
  await initializeDatabase();

  const toSnapshot = await getGameweeksToSnapshot();
  if (toSnapshot.size === 0) {
    console.log("No new gameweeks to snapshot");
    return;
  }

  // Managers often appear in several tracked leagues; fetch each once.
  const historyCache = new Map<number, EntryHistory>();
  const failedLeagues: number[] = [];

  for (const [leagueId, gws] of toSnapshot) {
    const league = TRACKED_LEAGUES.find((l) => l.id === leagueId);
    console.log(`\nProcessing league: ${league?.name} (ID: ${leagueId}), GWs ${gws.join(", ")}`);

    try {
      await snapshotLeague(leagueId, gws, historyCache);
    } catch (error) {
      console.error(`  ✗ Failed to snapshot league ${leagueId}:`, error);
      failedLeagues.push(leagueId);
    }
  }

  if (failedLeagues.length > 0) {
    throw new Error(`Snapshot failed for leagues ${failedLeagues.join(", ")}`);
  }

  console.log("\n✓ Snapshot job completed");
}
