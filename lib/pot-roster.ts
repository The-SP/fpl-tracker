import { fetchLeagueStandings, fetchEntrySummary } from "./fpl";
import {
  POT_LEAGUE_ID,
  POT_EXCLUDE_ENTRY_IDS,
  POT_INCLUDE_ENTRY_IDS,
} from "@/config/pot";

export interface PotRosterMember {
  entry_id: number;
  entry_name: string;
  player_name: string;
}

/**
 * Builds the pot roster: everyone in POT_LEAGUE_ID, minus POT_EXCLUDE_ENTRY_IDS,
 * plus POT_INCLUDE_ENTRY_IDS (fetched individually since they aren't league members).
 * Run once to seed `pot_members` — see seedPotMembersIfEmpty in pot-db.ts.
 */
export async function resolvePotRoster(): Promise<PotRosterMember[]> {
  const standings = await fetchLeagueStandings(POT_LEAGUE_ID);

  const roster: PotRosterMember[] = standings
    .filter((s) => !POT_EXCLUDE_ENTRY_IDS.includes(s.entry))
    .map((s) => ({
      entry_id: s.entry,
      entry_name: s.entry_name,
      player_name: s.player_name,
    }));

  for (const entryId of POT_INCLUDE_ENTRY_IDS) {
    if (roster.some((m) => m.entry_id === entryId)) continue;

    const summary = await fetchEntrySummary(entryId);
    roster.push({
      entry_id: entryId,
      entry_name: summary.name,
      player_name: `${summary.player_first_name} ${summary.player_last_name}`,
    });
  }

  return roster;
}
