// NOTE: this assumes lib/db.ts exports the raw libsql client as `db`
// (e.g. `export const db = createClient({...})`). Adjust the import below
// if your client lives elsewhere or under a different export name.
import { db } from "./db";

export interface PotMember {
  entry_id: number;
  entry_name: string;
  player_name: string;
  active: boolean;
}

export interface PotGwResult {
  gw: number;
  entry_id: number;
  entry_name: string;
  player_name: string;
  points: number;
  rank: number;
  is_winner: boolean;
  chip: string | null;
}

export interface PotBalance {
  entry_id: number;
  entry_name: string;
  player_name: string;
  gws_played: number;
  wins: number;
  net: number;
}

export interface PotSettlement {
  settled_through_gw: number;
  settled_at: string;
}

function nullableString(value: unknown): string {
  return value == null ? "" : String(value);
}

async function addMissingColumns(
  table: string,
  columns: { name: string; definition: string }[],
): Promise<Set<string>> {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  const existing = new Set(
    result.rows.map((row) => String((row as { name?: unknown }).name)),
  );

  for (const column of columns) {
    if (!existing.has(column.name)) {
      // Legacy tables may already contain rows, so newly migrated columns
      // must be nullable even though new rows always provide these values.
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
  return existing;
}

export async function initializePotDatabase(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pot_members (
      entry_id INTEGER PRIMARY KEY,
      entry_name TEXT NOT NULL,
      player_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);
  const memberColumns = await addMissingColumns("pot_members", [
    { name: "entry_name", definition: "TEXT" },
    { name: "player_name", definition: "TEXT" },
  ]);
  if (memberColumns.has("name")) {
    await db.execute("UPDATE pot_members SET entry_name = name WHERE entry_name IS NULL");
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pot_gw_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gw INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      entry_name TEXT NOT NULL,
      player_name TEXT NOT NULL,
      points INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      is_winner INTEGER NOT NULL DEFAULT 0,
      chip TEXT,
      UNIQUE(gw, entry_id)
    )
  `);
  const resultColumns = await addMissingColumns("pot_gw_results", [
    { name: "entry_name", definition: "TEXT" },
    { name: "player_name", definition: "TEXT" },
  ]);
  if (resultColumns.has("name")) {
    await db.execute("UPDATE pot_gw_results SET entry_name = name WHERE entry_name IS NULL");
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pot_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settled_through_gw INTEGER NOT NULL,
      settled_at TEXT NOT NULL
    )
  `);
}

export async function getPotMembers(): Promise<PotMember[]> {
  const result = await db.execute("SELECT entry_id, entry_name, player_name, active FROM pot_members");
  return result.rows.map((r: any) => ({
    entry_id: Number(r.entry_id),
    entry_name: nullableString(r.entry_name),
    player_name: nullableString(r.player_name),
    active: !!r.active,
  }));
}

/**
 * Seeds pot_members from a resolved roster, but only if the table is empty.
 * This is the "capture the roster once" step — re-run manually (or edit the
 * table directly) if the roster ever needs to change, rather than
 * re-deriving it from the league automatically every run.
 */
export async function seedPotMembersIfEmpty(
  members: { entry_id: number; entry_name: string; player_name: string }[]
): Promise<void> {
  const existing = await getPotMembers();
  if (existing.length > 0) return;

  for (const m of members) {
    await db.execute({
      sql: "INSERT INTO pot_members (entry_id, entry_name, player_name, active) VALUES (?, ?, ?, 1)",
      args: [m.entry_id, m.entry_name, m.player_name],
    });
  }
}

export async function updatePotMemberNames(
  entryId: number,
  entryName: string,
  playerName: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE pot_members SET entry_name = ?, player_name = ? WHERE entry_id = ?",
    args: [entryName, playerName, entryId],
  });
  await db.execute({
    sql: "UPDATE pot_gw_results SET entry_name = ?, player_name = ? WHERE entry_id = ?",
    args: [entryName, playerName, entryId],
  });
}

export async function potResultExists(gw: number, entryId: number): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 FROM pot_gw_results WHERE gw = ? AND entry_id = ?",
    args: [gw, entryId],
  });
  return result.rows.length > 0;
}

export async function storePotResult(result: PotGwResult): Promise<void> {
  await db.execute({
    sql: `INSERT INTO pot_gw_results (gw, entry_id, entry_name, player_name, points, rank, is_winner, chip)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(gw, entry_id) DO UPDATE SET
            entry_name = excluded.entry_name,
            player_name = excluded.player_name,
            points = excluded.points,
            rank = excluded.rank,
            is_winner = excluded.is_winner,
            chip = excluded.chip`,
    args: [
      result.gw,
      result.entry_id,
      result.entry_name,
      result.player_name,
      result.points,
      result.rank,
      result.is_winner ? 1 : 0,
      result.chip,
    ],
  });
}

export async function getAllPotResultsByGw(): Promise<Map<number, PotGwResult[]>> {
  const result = await db.execute(
    "SELECT gw, entry_id, entry_name, player_name, points, rank, is_winner, chip FROM pot_gw_results ORDER BY gw DESC, rank ASC"
  );

  const byGw = new Map<number, PotGwResult[]>();
  for (const row of result.rows as any[]) {
    const r: PotGwResult = {
      gw: Number(row.gw),
      entry_id: Number(row.entry_id),
      entry_name: nullableString(row.entry_name),
      player_name: nullableString(row.player_name),
      points: Number(row.points),
      rank: Number(row.rank),
      is_winner: !!row.is_winner,
      chip: row.chip ? String(row.chip) : null,
    };
    if (!byGw.has(r.gw)) byGw.set(r.gw, []);
    byGw.get(r.gw)!.push(r);
  }
  return byGw;
}

export async function getLastSettlement(): Promise<PotSettlement | null> {
  const result = await db.execute(
    "SELECT settled_through_gw, settled_at FROM pot_settlements ORDER BY settled_through_gw DESC LIMIT 1"
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return {
    settled_through_gw: Number(row.settled_through_gw),
    settled_at: String(row.settled_at),
  };
}

export async function settlePot(throughGw: number): Promise<void> {
  await db.execute({
    sql: "INSERT INTO pot_settlements (settled_through_gw, settled_at) VALUES (?, ?)",
    args: [throughGw, new Date().toISOString()],
  });
}

/**
 * Balances since the given GW (exclusive) — pass the last settlement's
 * settled_through_gw, or 0 if never settled.
 * Weekly pot size is derived per-GW as feePerMember * (members who played
 * that GW), so it scales correctly even if the roster changes over time.
 * Ties split the pot evenly among that GW's winners.
 */
export async function getPotBalances(
  sinceGw: number,
  feePerMember: number
): Promise<PotBalance[]> {
  const byGw = await getAllPotResultsByGw();
  const balances = new Map<number, PotBalance>();

  for (const [gw, rows] of byGw) {
    if (gw <= sinceGw) continue;

    const potSize = feePerMember * rows.length;
    const winners = rows.filter((r) => r.is_winner);
    const share = winners.length > 0 ? potSize / winners.length : 0;

    for (const row of rows) {
      if (!balances.has(row.entry_id)) {
        balances.set(row.entry_id, {
          entry_id: row.entry_id,
          entry_name: row.entry_name,
          player_name: row.player_name,
          gws_played: 0,
          wins: 0,
          net: 0,
        });
      }
      const b = balances.get(row.entry_id)!;
      b.gws_played += 1;
      b.net -= feePerMember;
      if (row.is_winner) {
        b.wins += 1;
        b.net += share;
      }
    }
  }

  return Array.from(balances.values()).sort((a, b) => b.net - a.net);
}
