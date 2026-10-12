const BASE_URL = "https://fantasy.premierleague.com/api";

export interface BootstrapEvent {
  id: number;
  name: string;
  deadline_time: string;
  average_entry_score: number;
  finished: boolean;
  data_checked: boolean;
  is_current: boolean;
  is_next: boolean;
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

const FPL_SITE_URL = "https://fantasy.premierleague.com/en";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * GET a JSON resource from the FPL API with a per-attempt timeout and a small
 * exponential backoff for rate limits, server errors, and network failures.
 */
async function fetchFplJson<T>(path: string, description: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return (await response.json()) as T;

      lastError = new Error(
        `Failed to fetch ${description}: ${response.status} ${response.statusText}`
      );
      if (!isRetryableStatus(response.status)) break;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${description}`);
}

/**
 * Fetch bootstrap-static data to get event info
 */
export function fetchBootstrap(): Promise<BootstrapData> {
  return fetchFplJson("/bootstrap-static/", "bootstrap data");
}

/**
 * Fetch all standings pages for a league
 */
export async function fetchLeagueStandings(leagueId: number): Promise<StandingsEntry[]> {
  const allResults: StandingsEntry[] = [];
  let pageNum = 1;

  while (true) {
    const data = await fetchFplJson<StandingsResponse>(
      `/leagues-classic/${leagueId}/standings/?page_standings=${pageNum}`,
      `standings for league ${leagueId}`
    );
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
export function fetchEntryHistory(entryId: number): Promise<EntryHistory> {
  return fetchFplJson(`/entry/${entryId}/history/`, `history for entry ${entryId}`);
}

/**
 * Fetch basic profile info (name/team name) for a single manager.
 * Used to resolve display names for entries pulled in manually
 * (e.g. someone who isn't a member of the source league).
 */
export function fetchEntrySummary(entryId: number): Promise<EntrySummary> {
  return fetchFplJson(`/entry/${entryId}/`, `entry summary for ${entryId}`);
}

/**
 * Fetch histories for many entries with bounded concurrency. Failed entries are
 * reported separately so callers can decide whether partial data is usable.
 */
export async function fetchEntryHistories(
  entryIds: number[],
  concurrency = 10
): Promise<{ histories: Map<number, EntryHistory>; failedIds: number[] }> {
  const histories = new Map<number, EntryHistory>();
  const failedIds: number[] = [];
  const uniqueIds = [...new Set(entryIds)];

  for (let i = 0; i < uniqueIds.length; i += concurrency) {
    const batch = uniqueIds.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((id) => fetchEntryHistory(id)));
    results.forEach((result, index) => {
      const entryId = batch[index];
      if (result.status === "fulfilled") {
        histories.set(entryId, result.value);
      } else {
        failedIds.push(entryId);
        console.error(`Failed to fetch history for entry ${entryId}:`, result.reason);
      }
    });
  }

  return { histories, failedIds };
}

/**
 * The gameweek currently being played, or the most recently started one
 * between gameweeks. Falls back to the first gameweek before the season.
 */
export function getCurrentGameweek(bootstrap: BootstrapData): number {
  const current = bootstrap.events.find((event) => event.is_current);
  if (current) return current.id;

  const lastFinished = bootstrap.events.filter((event) => event.finished).at(-1);
  return lastFinished?.id ?? bootstrap.events[0]?.id ?? 1;
}

/** Public FPL page for a manager's team in one gameweek. */
export function fplEventUrl(entryId: number, gw: number): string {
  return `${FPL_SITE_URL}/entry/${entryId}/event/${gw}`;
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
