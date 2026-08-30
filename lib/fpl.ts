const BASE_URL = "https://fantasy.premierleague.com/api";

export interface BootstrapEvent {
  id: number;
  name: string;
  deadline_time: string;
  average_entry_score: number;
  finished: boolean;
  data_checked: boolean;
  highest_scoring_entry?: number;
  stats?: Array<{
    name: string;
    hit: number;
  }>;
  top_element?: number;
  top_element_info?: {
    id: number;
    points: number;
  };
  transfers_made?: number;
  most_transferred_in?: number;
  most_transferred_out?: number;
}

export interface BootstrapData {
  events: BootstrapEvent[];
  total_players: number;
  teams: Array<{
    id: number;
    name: string;
    short_name: string;
  }>;
}

export interface StandingsEntry {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  total: number;
  event_total: number;
}

export interface StandingsResponse {
  league: {
    id: number;
    name: string;
    closed: boolean;
  };
  standings: {
    count: number;
    has_next: boolean;
    results: StandingsEntry[];
  };
}

export interface EntryHistoryItem {
  event: number;
  points: number;
  total_points: number;
  rank?: number;
  rank_sort?: number;
  percentage_change?: number;
}

export interface EntryHistoryChip {
  name: string; // e.g. "wildcard", "freehit", "bboost", "3xc", "manager"
  time: string;
  event: number;
}

export interface EntryHistory {
  current: EntryHistoryItem[];
  chips: EntryHistoryChip[];
  previous?: Array<{
    event_transfers: number;
    event_transfers_cost: number;
    total_transfers: number;
    total_transfers_cost: number;
    season_name: string;
    elite_set?: number;
  }>;
}

export interface EntrySummary {
  id: number;
  name: string; // team name
  player_first_name: string;
  player_last_name: string;
}

/**
 * Fetch bootstrap-static data to get event info
 */
export async function fetchBootstrap(): Promise<BootstrapData> {
  const response = await fetch(`${BASE_URL}/bootstrap-static/`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch bootstrap data: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Fetch all standings pages for a league
 */
export async function fetchLeagueStandings(leagueId: number): Promise<StandingsEntry[]> {
  const allResults: StandingsEntry[] = [];
  let pageNum = 1;

  while (true) {
    const response = await fetch(
      `${BASE_URL}/leagues-classic/${leagueId}/standings/?page_standings=${pageNum}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch standings for league ${leagueId}: ${response.status} ${response.statusText}`
      );
    }

    const data: StandingsResponse = await response.json();
    allResults.push(...data.standings.results);

    // If this page is empty or there's no next page, we're done
    if (data.standings.results.length === 0 || !data.standings.has_next) {
      break;
    }

    pageNum++;
  }

  return allResults;
}

/**
 * Fetch entry history for a single manager
 */
export async function fetchEntryHistory(entryId: number): Promise<EntryHistory> {
  const response = await fetch(`${BASE_URL}/entry/${entryId}/history/`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch history for entry ${entryId}: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch basic profile info (name/team name) for a single manager.
 * Used to resolve display names for entries pulled in manually
 * (e.g. someone who isn't a member of the source league).
 */
export async function fetchEntrySummary(entryId: number): Promise<EntrySummary> {
  const response = await fetch(`${BASE_URL}/entry/${entryId}/`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch entry summary for ${entryId}: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get the points for a specific gameweek from entry history
 */
export function getGameweekPointsFromHistory(
  history: EntryHistory,
  gw: number
): { points: number; total_points: number } | null {
  const gwData = history.current.find((item) => item.event === gw);
  if (!gwData) {
    return null;
  }

  return {
    points: gwData.points,
    total_points: gwData.total_points,
  };
}

/**
 * Get the chip played (if any) in a specific gameweek, for reference display.
 * Does not affect points/ranking — FPL's `points` field is already net of
 * transfer-cost hits.
 */
export function getChipForGameweek(history: EntryHistory, gw: number): string | null {
  const chip = history.chips?.find((c) => c.event === gw);
  return chip ? chip.name : null;
}
