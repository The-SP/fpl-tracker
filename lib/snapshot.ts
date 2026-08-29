import {
  fetchBootstrap,
  fetchLeagueStandings,
  fetchEntryHistory,
  getGameweekPointsFromHistory,
} from "./fpl";
import {
  storeSnapshot,
  snapshotExists,
  initializeDatabase,
  type GWSnapshot,
  type Top5Manager,
} from "./db";
import { TRACKED_LEAGUES, USER_ENTRY_ID } from "@/config/leagues";

/**
 * Fetch all finalized gameweeks that need snapshotting
 */
export async function getFinalizedGameweeks(): Promise<number[]> {
  const bootstrap = await fetchBootstrap();

  return bootstrap.events
    .filter((event) => event.finished && event.data_checked)
    .map((event) => event.id);
}

/**
 * Get gameweeks that need snapshotting (finalized but not in DB)
 */
export async function getGameweeksToSnapshot(): Promise<
  Array<{ leagueId: number; gw: number }>
> {
  const finalizedGws = await getFinalizedGameweeks();
  const toSnapshot: Array<{ leagueId: number; gw: number }> = [];

  for (const gw of finalizedGws) {
    for (const league of TRACKED_LEAGUES) {
      const exists = await snapshotExists(league.id, gw);
      if (!exists) {
        toSnapshot.push({ leagueId: league.id, gw });
      }
    }
  }

  return toSnapshot;
}

interface ManagerWithPoints {
  entry_id: number;
  name: string;
  points: number;
  total_points: number;
  rank?: number;
}

/**
 * Snapshot a single gameweek for a single league
 */
export async function snapshotLeagueGameweek(
  leagueId: number,
  gw: number
): Promise<GWSnapshot | null> {
  console.log(`Snapshotting league ${leagueId} for GW ${gw}...`);

  // Fetch all standings pages to get full member list
  const standings = await fetchLeagueStandings(leagueId);

  if (!standings.some((entry) => entry.entry === USER_ENTRY_ID)) {
    console.warn(
      `  Skipping league ${leagueId} for GW ${gw}: user entry ${USER_ENTRY_ID} is not in this league.`
    );
    return null;
  }

  const entryIds = standings.map((s) => s.entry);

  // Deduplicate entry IDs
  const uniqueEntryIds = [...new Set(entryIds)];

  console.log(
    `  Found ${uniqueEntryIds.length} unique managers in league ${leagueId}`
  );

  // Fetch history for each manager with concurrency control
  const managersWithPoints: ManagerWithPoints[] = [];
  const CONCURRENCY = 10;

  for (let i = 0; i < uniqueEntryIds.length; i += CONCURRENCY) {
    const batch = uniqueEntryIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (entryId) => {
        try {
          const history = await fetchEntryHistory(entryId);
          const gwPoints = getGameweekPointsFromHistory(history, gw);

          if (!gwPoints) {
            return null;
          }

          const standingsEntry = standings.find((s) => s.entry === entryId);
          return {
            entry_id: entryId,
            name: standingsEntry?.entry_name || `Entry ${entryId}`,
            points: gwPoints.points,
            total_points: gwPoints.total_points,
          };
        } catch (error) {
          console.error(`  Failed to fetch history for entry ${entryId}:`, error);
          return null;
        }
      })
    );

    managersWithPoints.push(...results.filter((r) => r !== null));
  }

  // Sort by points descending, then by total_points descending for tiebreaker
  managersWithPoints.sort((a, b) => {
    if (a.points !== b.points) {
      return b.points - a.points;
    }
    return b.total_points - a.total_points;
  });

  // Assign ranks based on sorted order
  managersWithPoints.forEach((manager, index) => {
    manager.rank = index + 1;
  });

  // Find user's rank and points
  const userData = managersWithPoints.find((m) => m.entry_id === USER_ENTRY_ID);
  if (!userData) {
    console.warn(
      `  Skipping league ${leagueId} for GW ${gw}: user entry ${USER_ENTRY_ID} was not present in the standings after history lookup.`
    );
    return null;
  }

  // Get top 5 managers
  const top5: Top5Manager[] = managersWithPoints.slice(0, 5).map((m) => ({
    entry_id: m.entry_id,
    name: m.name,
    points: m.points,
    rank: m.rank!,
  }));

  const snapshot: GWSnapshot = {
    league_id: leagueId,
    gw,
    my_rank: userData.rank!,
    my_points: userData.points,
    top5,
    fetched_at: new Date().toISOString(),
  };

  // Store in database
  await storeSnapshot(snapshot);
  console.log(`  ✓ Snapshot stored: rank ${userData.rank}, points ${userData.points}`);

  return snapshot;
}

/**
 * Run the full snapshot job for all finalized gameweeks
 */
export async function runSnapshotJob(): Promise<void> {
  try {
    await initializeDatabase();

    const toSnapshot = await getGameweeksToSnapshot();

    if (toSnapshot.length === 0) {
      console.log("No new gameweeks to snapshot");
      return;
    }

    console.log(`Found ${toSnapshot.length} gameweek(s) to snapshot`);

    // Deduplicate by gameweek to process each GW only once across all leagues
    const gwsByLeague = new Map<number, number[]>();
    for (const { leagueId, gw } of toSnapshot) {
      if (!gwsByLeague.has(leagueId)) {
        gwsByLeague.set(leagueId, []);
      }
      gwsByLeague.get(leagueId)!.push(gw);
    }

    // Process each league
    for (const [leagueId, gws] of gwsByLeague) {
      const league = TRACKED_LEAGUES.find((l) => l.id === leagueId);
      console.log(`\nProcessing league: ${league?.name} (ID: ${leagueId})`);

      for (const gw of gws) {
        try {
          const snapshot = await snapshotLeagueGameweek(leagueId, gw);
          if (!snapshot) {
            continue;
          }
        } catch (error) {
          console.error(`  ✗ Failed to snapshot GW ${gw}:`, error);
          // Continue with other gameweeks/leagues
        }
      }
    }

    console.log("\n✓ Snapshot job completed");
  } catch (error) {
    console.error("Snapshot job failed:", error);
    throw error;
  }
}
