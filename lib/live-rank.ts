import { fetchBootstrap, fetchLeagueStandings, getCurrentGameweek } from "./fpl";
import { TRACKED_LEAGUES, USER_ENTRY_ID } from "@/config/leagues";

export interface LiveRankResult {
  league_id: number;
  league_name: string;
  my_rank: number;
  my_points: number;
  current_gw: number;
  top5: Array<{
    rank: number;
    entry_id: number;
    name: string;
    points: number;
  }>;
}

async function fetchCurrentGameweek(): Promise<number> {
  return getCurrentGameweek(await fetchBootstrap());
}

/**
 * Get live rank for a specific league. Pass `currentGw` when checking several
 * leagues so bootstrap data is only fetched once.
 */
export async function getLiveRankForLeague(
  leagueId: number,
  currentGw?: number
): Promise<LiveRankResult> {
  const league = TRACKED_LEAGUES.find((l) => l.id === leagueId);
  if (!league) {
    throw new Error(`League ${leagueId} not found in tracked leagues`);
  }

  const [gw, standings] = await Promise.all([
    currentGw ?? fetchCurrentGameweek(),
    fetchLeagueStandings(leagueId),
  ]);

  // Sort by event_total descending (current gameweek live score)
  const sorted = [...standings].sort((a, b) => {
    if (a.event_total !== b.event_total) {
      return b.event_total - a.event_total;
    }
    // Tiebreaker: sort by total points descending
    return b.total - a.total;
  });

  const userIndex = sorted.findIndex((s) => s.entry === USER_ENTRY_ID);
  if (userIndex === -1) {
    throw new Error(`User (entry ${USER_ENTRY_ID}) not found in league ${leagueId}`);
  }

  const top5 = sorted.slice(0, 5).map((entry, index) => ({
    rank: index + 1,
    entry_id: entry.entry,
    name: entry.entry_name,
    points: entry.event_total,
  }));

  return {
    league_id: leagueId,
    league_name: league.name,
    my_rank: userIndex + 1,
    my_points: sorted[userIndex].event_total,
    current_gw: gw,
    top5,
  };
}

/**
 * Get live rank for all tracked leagues, in parallel
 */
export async function getLiveRankForAllLeagues(): Promise<LiveRankResult[]> {
  const currentGw = await fetchCurrentGameweek();
  const results = await Promise.allSettled(
    TRACKED_LEAGUES.map((league) => getLiveRankForLeague(league.id, currentGw))
  );

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.error(`Failed to get live rank for league ${TRACKED_LEAGUES[index].id}:`, result.reason);
    return [];
  });
}
