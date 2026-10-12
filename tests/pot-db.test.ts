import { beforeAll, describe, expect, it } from "vitest"
import { db, initializeDatabase } from "@/lib/db"
import {
  computePotBalances,
  getAllPotResultsByGw,
  getLatestFinalPotGw,
  recalculatePotRankings,
  type PotGwResult,
} from "@/lib/pot-db"

function result(gw: number, entryId: number, points: number, overrides: Partial<PotGwResult> = {}): PotGwResult {
  return {
    gw,
    entry_id: entryId,
    entry_name: `Team ${entryId}`,
    player_name: `Player ${entryId}`,
    points,
    rank: 0,
    is_winner: false,
    chip: null,
    is_final: true,
    ...overrides,
  }
}

describe("computePotBalances", () => {
  it("charges everyone the fee and pays the pot to the winner", () => {
    const byGw = new Map([[1, [result(1, 1, 80, { is_winner: true }), result(1, 2, 50), result(1, 3, 40)]]])
    const balances = computePotBalances(byGw, 0, 100)
    expect(balances.map((b) => [b.entry_id, b.net])).toEqual([[1, 200], [2, -100], [3, -100]])
    expect(balances[0].won_gws).toEqual([1])
  })

  it("splits the pot evenly between tied winners", () => {
    const byGw = new Map([[1, [
      result(1, 1, 80, { is_winner: true }),
      result(1, 2, 80, { is_winner: true }),
      result(1, 3, 80, { is_winner: true }),
      result(1, 4, 20),
    ]]])
    const nets = computePotBalances(byGw, 0, 100).map((b) => b.net)
    expect(nets.slice(0, 3)).toEqual([100 * 4 / 3 - 100, 100 * 4 / 3 - 100, 100 * 4 / 3 - 100])
    expect(nets.reduce((sum, net) => sum + net, 0)).toBeCloseTo(0)
  })

  it("skips settled and provisional gameweeks", () => {
    const byGw = new Map([
      [1, [result(1, 1, 80, { is_winner: true }), result(1, 2, 50)]],
      [2, [result(2, 1, 30), result(2, 2, 60, { is_winner: true })]],
      [3, [result(3, 1, 90, { is_winner: true }), result(3, 2, 10, { is_final: false })]],
    ])
    const balances = computePotBalances(byGw, 1, 100)
    expect(balances.map((b) => [b.entry_id, b.net, b.gws_played])).toEqual([[2, 100, 1], [1, -100, 1]])
  })
})

describe("pot database", () => {
  beforeAll(async () => {
    await initializeDatabase()
    await db.batch(
      [
        ...[1, 2, 3, 4].map((id) => ({
          sql: "INSERT INTO pot_members (entry_id, entry_name, player_name) VALUES (?, ?, ?)",
          args: [id, `Team ${id}`, `Player ${id}`],
        })),
        // GW 1: three-way tie at the top, stored with wrong ranks.
        ...[[1, 70], [2, 70], [3, 70], [4, 40]].map(([id, points]) => ({
          sql: "INSERT INTO pot_gw_results (gw, entry_id, points, rank, is_winner, is_final) VALUES (1, ?, ?, 9, 0, 1)",
          args: [id, points],
        })),
        // GW 2: still provisional for one member.
        ...[[1, 50, 1], [2, 60, 0]].map(([id, points, isFinal]) => ({
          sql: "INSERT INTO pot_gw_results (gw, entry_id, points, rank, is_winner, is_final) VALUES (2, ?, ?, 0, 0, ?)",
          args: [id, points, isFinal],
        })),
      ],
      "write"
    )
  })

  it("recalculates ranks and winners with shared ranks for ties", async () => {
    await recalculatePotRankings()
    const gw1 = (await getAllPotResultsByGw()).get(1)!
    expect(gw1.map((r) => [r.entry_id, r.rank, r.is_winner])).toEqual([
      [1, 1, true], [2, 1, true], [3, 1, true], [4, 4, false],
    ])
  })

  it("reports the latest gameweek whose rows are all final", async () => {
    expect(await getLatestFinalPotGw()).toBe(1)
  })
})
