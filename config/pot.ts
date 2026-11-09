// Source league the roster is derived from (Bros Before Hoes)
export const POT_LEAGUE_ID = 719910;

// Members of POT_LEAGUE_ID to exclude from the pot despite being in the league
export const POT_EXCLUDE_ENTRY_IDS: number[] = [5445232, 8741034];

// Entries to add to the pot despite NOT being members of POT_LEAGUE_ID
export const POT_INCLUDE_ENTRY_IDS: number[] = [155986];

// Entries that joined the pot partway through the season. They only count
// (pay the fee and can win) from fromGw onward.
export const POT_LATE_JOINERS: { entryId: number; fromGw: number }[] = [
  { entryId: 4777742, fromGw: 10 },
];

// Rs per person per gameweek
export const POT_ENTRY_FEE = 100;
