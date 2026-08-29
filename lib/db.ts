import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL || "file:./local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function initializeDatabase(): Promise<void> {
  try {
    await db.execute(`
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
    `);
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

export interface Top5Manager {
  entry_id: number;
  name: string;
  points: number;
  rank: number;
}

export interface GWSnapshot {
  id?: number;
  league_id: number;
  gw: number;
  my_rank: number;
  my_points: number;
  top5: Top5Manager[];
  fetched_at: string;
}

/**
 * Store a gameweek snapshot for a league
 */
export async function storeSnapshot(snapshot: GWSnapshot): Promise<void> {
  const { league_id, gw, my_rank, my_points, top5, fetched_at } = snapshot;

  try {
    await db.execute(
      `
      INSERT INTO gw_snapshots (league_id, gw, my_rank, my_points, top5_json, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(league_id, gw) DO UPDATE SET
        my_rank = excluded.my_rank,
        my_points = excluded.my_points,
        top5_json = excluded.top5_json,
        fetched_at = excluded.fetched_at
    `,
      [league_id, gw, my_rank, my_points, JSON.stringify(top5), fetched_at]
    );
  } catch (error) {
    console.error(`Failed to store snapshot for league ${league_id}, gw ${gw}:`, error);
    throw error;
  }
}

/**
 * Get a specific gameweek snapshot for a league
 */
export async function getSnapshot(leagueId: number, gw: number): Promise<GWSnapshot | null> {
  try {
    const result = await db.execute(
      `
      SELECT id, league_id, gw, my_rank, my_points, top5_json, fetched_at
      FROM gw_snapshots
      WHERE league_id = ? AND gw = ?
    `,
      [leagueId, gw]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as number,
      league_id: row.league_id as number,
      gw: row.gw as number,
      my_rank: row.my_rank as number,
      my_points: row.my_points as number,
      top5: JSON.parse(row.top5_json as string) as Top5Manager[],
      fetched_at: row.fetched_at as string,
    };
  } catch (error) {
    console.error(`Failed to get snapshot for league ${leagueId}, gw ${gw}:`, error);
    throw error;
  }
}

/**
 * Get all snapshots for a specific league
 */
export async function getLeagueSnapshots(leagueId: number): Promise<GWSnapshot[]> {
  try {
    const result = await db.execute(
      `
      SELECT id, league_id, gw, my_rank, my_points, top5_json, fetched_at
      FROM gw_snapshots
      WHERE league_id = ?
      ORDER BY gw ASC
    `,
      [leagueId]
    );

    return result.rows.map((row) => ({
      id: row.id as number,
      league_id: row.league_id as number,
      gw: row.gw as number,
      my_rank: row.my_rank as number,
      my_points: row.my_points as number,
      top5: JSON.parse(row.top5_json as string) as Top5Manager[],
      fetched_at: row.fetched_at as string,
    }));
  } catch (error) {
    console.error(`Failed to get snapshots for league ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Get latest snapshot for all leagues
 */
export async function getLatestSnapshots(): Promise<GWSnapshot[]> {
  try {
    const result = await db.execute(`
      SELECT id, league_id, gw, my_rank, my_points, top5_json, fetched_at
      FROM gw_snapshots
      WHERE (league_id, gw) IN (
        SELECT league_id, MAX(gw) FROM gw_snapshots GROUP BY league_id
      )
      ORDER BY league_id ASC
    `);

    return result.rows.map((row) => ({
      id: row.id as number,
      league_id: row.league_id as number,
      gw: row.gw as number,
      my_rank: row.my_rank as number,
      my_points: row.my_points as number,
      top5: JSON.parse(row.top5_json as string) as Top5Manager[],
      fetched_at: row.fetched_at as string,
    }));
  } catch (error) {
    console.error("Failed to get latest snapshots:", error);
    throw error;
  }
}

/**
 * Get the highest points scored in any gameweek per league
 */
export async function getHighestPointsPerLeague(): Promise<Map<number, number>> {
  try {
    const result = await db.execute(`
      SELECT league_id, MAX(my_points) as highest_points
      FROM gw_snapshots
      GROUP BY league_id
    `);

    const map = new Map<number, number>();
    result.rows.forEach((row) => {
      map.set(row.league_id as number, row.highest_points as number);
    });
    return map;
  } catch (error) {
    console.error("Failed to get highest points per league:", error);
    throw error;
  }
}

/**
 * Check if a snapshot already exists for a league and gameweek
 */
export async function snapshotExists(leagueId: number, gw: number): Promise<boolean> {
  try {
    const result = await db.execute(
      `SELECT 1 FROM gw_snapshots WHERE league_id = ? AND gw = ?`,
      [leagueId, gw]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Failed to check snapshot existence:`, error);
    throw error;
  }
}

export { db };
