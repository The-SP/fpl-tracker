export interface Migration {
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    name: "001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS gw_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER NOT NULL,
        gw INTEGER NOT NULL,
        my_rank INTEGER NOT NULL,
        my_points INTEGER NOT NULL,
        top5_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        UNIQUE(league_id, gw)
      );
      CREATE TABLE IF NOT EXISTS snapshot_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        called_at TEXT NOT NULL,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS pot_members (
        entry_id INTEGER PRIMARY KEY,
        entry_name TEXT NOT NULL,
        player_name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS pot_gw_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gw INTEGER NOT NULL,
        entry_id INTEGER NOT NULL,
        points INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        is_winner INTEGER NOT NULL DEFAULT 0,
        chip TEXT,
        UNIQUE(gw, entry_id),
        FOREIGN KEY (entry_id) REFERENCES pot_members(entry_id)
      );
      CREATE TABLE IF NOT EXISTS pot_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        settled_through_gw INTEGER NOT NULL,
        settled_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pot_snapshot_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        called_at TEXT NOT NULL,
        status TEXT
      );
    `,
  },
  {
    name: "002_pot_result_status",
    sql: `
      ALTER TABLE pot_gw_results ADD COLUMN is_final INTEGER NOT NULL DEFAULT 1;
    `,
  },
]
