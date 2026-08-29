import { fetchBootstrap, fetchLeagueStandings } from "./fpl";
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

async function getCurrentGameweek(): Promise<number> {
  const bootstrap = await fetchBootstrap();

  const activeGw = bootstrap.events
    .filter((event) => !event.finished)
    .sort((a, b) => a.id - b.id)[0];

  return activeGw?.id ?? bootstrap.events[bootstrap.events.length - 1]?.id ?? 1;
}

/**
 * Get live rank for a specific league
 */
export async function getLiveRankForLeague(
  leagueId: number
): Promise<LiveRankResult> {
  const league = TRACKED_LEAGUES.find((l) => l.id === leagueId);
  if (!league) {
    throw new Error(`League ${leagueId} not found in tracked leagues`);
  }

  const currentGw = await getCurrentGameweek();

  // Fetch standings
  const standings = await fetchLeagueStandings(leagueId);

  // Sort by event_total descending (current gameweek live score)
  const sorted = [...standings].sort((a, b) => {
    if (a.event_total !== b.event_total) {
      return b.event_total - a.event_total;
    }
    // Tiebreaker: sort by total points descending
    return b.total - a.total;
  });

  // Find user's rank
  const userEntry = sorted.find((s) => s.entry === USER_ENTRY_ID);
  if (!userEntry) {
    throw new Error(`User (entry ${USER_ENTRY_ID}) not found in league ${leagueId}`);
  }

  const userRank = sorted.findIndex((s) => s.entry === USER_ENTRY_ID) + 1;

  // Get top 5
  const top5 = sorted.slice(0, 5).map((entry, index) => ({
    rank: index + 1,
    entry_id: entry.entry,
    name: entry.entry_name,
    points: entry.event_total,
  }));

  return {
    league_id: leagueId,
    league_name: league.name,
    my_rank: userRank,
    my_points: userEntry.event_total,
    current_gw: currentGw,
    top5,
  };
}

/**
 * Get live rank for all tracked leagues
 */
export async function getLiveRankForAllLeagues(): Promise<LiveRankResult[]> {
  const results: LiveRankResult[] = [];

  for (const league of TRACKED_LEAGUES) {
    try {
      const result = await getLiveRankForLeague(league.id);
      results.push(result);
    } catch (error) {
      console.error(`Failed to get live rank for league ${league.id}:`, error);
      // Continue with other leagues
    }
  }

  return results;
}
