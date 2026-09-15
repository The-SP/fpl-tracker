import { db } from "./db"

export interface PotMember {
  entry_id: number
  entry_name: string
  player_name: string
  active: boolean
}

export interface PotGwResult {
  gw: number
  entry_id: number
  // Joined from pot_members when results are read; not stored in
  // pot_gw_results.
  entry_name: string
  player_name: string
  points: number
  rank: number
  is_winner: boolean
  chip: string | null
  is_final: boolean
}

export interface PotBalance {
  entry_id: number
  entry_name: string
  player_name: string
  gws_played: number
  latest_gw: number
  won_gws: number[]
  wins: number
  net: number
}

export interface PotSettlement {
  settled_through_gw: number
  settled_at: string
}

export interface PotOverallResult {
  entry_id: number
  entry_name: string
  player_name: string
  points: number
  rank: number
  gws_played: number
  latest_gw: number
  is_final: boolean
}

function nullableString(value: unknown): string {
  return value == null ? "" : String(value)
}

type DatabaseRow = Record<string, unknown>

export async function getLatestPotSnapshotCall(): Promise<string | null> {
  const result = await db.execute(
    "SELECT called_at FROM pot_snapshot_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1"
  )
  return result.rows.length > 0 ? String(result.rows[0].called_at) : null
}

export async function recordPotSnapshotCall(calledAt: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO pot_snapshot_runs (called_at, status) VALUES (?, 'success')",
    args: [calledAt],
  })
}

export async function getPotMembers(): Promise<PotMember[]> {
  const result = await db.execute(
    "SELECT entry_id, entry_name, player_name, active FROM pot_members"
  )
  return (result.rows as DatabaseRow[]).map((r) => ({
    entry_id: Number(r.entry_id),
    entry_name: nullableString(r.entry_name),
    player_name: nullableString(r.player_name),
    active: !!r.active,
  }))
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
  const existing = await getPotMembers()
  if (existing.length > 0) return

  for (const m of members) {
    await db.execute({
      sql: "INSERT INTO pot_members (entry_id, entry_name, player_name, active) VALUES (?, ?, ?, 1)",
      args: [m.entry_id, m.entry_name, m.player_name],
    })
  }
}

export async function updatePotMemberNames(
  entryId: number,
  entryName: string,
  playerName: string
): Promise<void> {
  await db.execute({
    sql: "UPDATE pot_members SET entry_name = ?, player_name = ? WHERE entry_id = ?",
    args: [entryName, playerName, entryId],
  })
}

export async function potResultExists(
  gw: number,
  entryId: number
): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 FROM pot_gw_results WHERE gw = ? AND entry_id = ?",
    args: [gw, entryId],
  })
  return result.rows.length > 0
}

export async function potResultIsFinal(
  gw: number,
  entryId: number,
): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT is_final FROM pot_gw_results WHERE gw = ? AND entry_id = ?",
    args: [gw, entryId],
  })
  return result.rows.length > 0 && !!result.rows[0].is_final
}

export async function storePotResult(result: PotGwResult): Promise<void> {
  await db.execute({
    sql: `INSERT INTO pot_gw_results (gw, entry_id, points, rank, is_winner, chip, is_final)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(gw, entry_id) DO UPDATE SET
            points = excluded.points,
            rank = excluded.rank,
            is_winner = excluded.is_winner,
            chip = excluded.chip,
            is_final = excluded.is_final`,
    args: [
      result.gw,
      result.entry_id,
      result.points,
      result.rank,
      result.is_winner ? 1 : 0,
      result.chip,
      result.is_final ? 1 : 0,
    ],
  })
}

export async function recalculatePotRankings(): Promise<void> {
  const result = await db.execute(
    "SELECT gw, entry_id, points FROM pot_gw_results ORDER BY gw ASC, points DESC"
  )
  const byGw = new Map<number, { entryId: number; points: number }[]>()

  for (const row of result.rows as DatabaseRow[]) {
    const gw = Number(row.gw)
    if (!byGw.has(gw)) byGw.set(gw, [])
    byGw.get(gw)!.push({ entryId: Number(row.entry_id), points: Number(row.points) })
  }

  for (const [gw, rows] of byGw.entries()) {
    const topScore = rows[0]?.points
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const previousRow = rows[index - 1]
      const rank = index > 0 && previousRow.points === row.points
        ? index
        : index + 1
      await db.execute({
        sql: "UPDATE pot_gw_results SET rank = ?, is_winner = ? WHERE gw = ? AND entry_id = ?",
        args: [rank, row.points === topScore ? 1 : 0, gw, row.entryId],
      })
    }
  }
}

export async function getAllPotResultsByGw(): Promise<
  Map<number, PotGwResult[]>
> {
  const result = await db.execute(
    `SELECT r.gw, r.entry_id, m.entry_name, m.player_name,
            r.points, r.rank, r.is_winner, r.chip, r.is_final
     FROM pot_gw_results r
     JOIN pot_members m ON m.entry_id = r.entry_id
     ORDER BY r.gw DESC, r.rank ASC`
  )

  const byGw = new Map<number, PotGwResult[]>()
  for (const row of result.rows as DatabaseRow[]) {
    const r: PotGwResult = {
      gw: Number(row.gw),
      entry_id: Number(row.entry_id),
      entry_name: nullableString(row.entry_name),
      player_name: nullableString(row.player_name),
      points: Number(row.points),
      rank: Number(row.rank),
      is_winner: !!row.is_winner,
      chip: row.chip ? String(row.chip) : null,
      is_final: !!row.is_final,
    }
    if (!byGw.has(r.gw)) byGw.set(r.gw, [])
    byGw.get(r.gw)!.push(r)
  }
  return byGw
}

export async function getOverallPotResults(): Promise<PotOverallResult[]> {
  const result = await db.execute(
    `SELECT r.entry_id, m.entry_name, m.player_name,
            SUM(r.points) AS points,
            COUNT(DISTINCT r.gw) AS gws_played,
            MAX(r.gw) AS latest_gw,
            MIN(r.is_final) AS is_final
     FROM pot_gw_results r
     JOIN pot_members m ON m.entry_id = r.entry_id
     GROUP BY r.entry_id, m.entry_name, m.player_name
     ORDER BY points DESC, m.player_name ASC`
  )

  const rows = (result.rows as DatabaseRow[]).map((row) => ({
    entry_id: Number(row.entry_id),
    entry_name: nullableString(row.entry_name),
    player_name: nullableString(row.player_name),
    points: Number(row.points),
    rank: 0,
    gws_played: Number(row.gws_played),
    latest_gw: Number(row.latest_gw),
    is_final: !!row.is_final,
  }))

  let currentRank = 1
  for (let index = 0; index < rows.length; index++) {
    if (index > 0 && rows[index - 1].points !== rows[index].points) {
      currentRank = index + 1
    }
    rows[index].rank = currentRank
  }

  return rows
}

export async function getLastSettlement(): Promise<PotSettlement | null> {
  const result = await db.execute(
    "SELECT settled_through_gw, settled_at FROM pot_settlements ORDER BY settled_through_gw DESC LIMIT 1"
  )
  if (result.rows.length === 0) return null
  const row = result.rows[0] as DatabaseRow
  return {
    settled_through_gw: Number(row.settled_through_gw),
    settled_at: String(row.settled_at),
  }
}

export async function settlePot(throughGw: number): Promise<void> {
  await db.execute({
    sql: "INSERT INTO pot_settlements (settled_through_gw, settled_at) VALUES (?, ?)",
    args: [throughGw, new Date().toISOString()],
  })
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
  const byGw = await getAllPotResultsByGw()
  const balances = new Map<number, PotBalance>()

  for (const [gw, rows] of byGw) {
    if (rows.some((row) => !row.is_final)) continue
    if (gw <= sinceGw) continue

    const potSize = feePerMember * rows.length
    const winners = rows.filter((r) => r.is_winner)
    const share = winners.length > 0 ? potSize / winners.length : 0

    for (const row of rows) {
      if (!balances.has(row.entry_id)) {
        balances.set(row.entry_id, {
          entry_id: row.entry_id,
          entry_name: row.entry_name,
          player_name: row.player_name,
          gws_played: 0,
          latest_gw: 0,
          won_gws: [],
          wins: 0,
          net: 0,
        })
      }
      const b = balances.get(row.entry_id)!
      b.gws_played += 1
      b.latest_gw = Math.max(b.latest_gw, gw)
      b.net -= feePerMember
      if (row.is_winner) {
        b.wins += 1
        b.won_gws.push(gw)
        b.net += share
      }
    }
  }

  return Array.from(balances.values()).sort((a, b) => b.net - a.net)
}
