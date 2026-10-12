import { describe, expect, it } from "vitest"
import { USER_ENTRY_ID } from "@/config/leagues"
import type { EntryHistory, StandingsEntry } from "@/lib/fpl"
import { buildLeagueSnapshot } from "@/lib/snapshot"

const standing = (entry: number): StandingsEntry => ({
  entry,
  entry_name: `Team ${entry}`,
  player_name: `Player ${entry}`,
  rank: 0,
  last_rank: 0,
  total: 0,
  event_total: 0,
})

const history = (gw: number, points: number, total: number): EntryHistory => ({
  current: [{ event: gw, points, total_points: total }],
  chips: [],
})

describe("buildLeagueSnapshot", () => {
  it("ranks by gameweek points, breaks ties on total, and ignores duplicate entries", () => {
    const standings = [standing(1), standing(USER_ENTRY_ID), standing(2), standing(1)]
    const histories = new Map([
      [1, history(5, 70, 300)],
      [USER_ENTRY_ID, history(5, 70, 310)],
      [2, history(5, 90, 200)],
    ])
    const snapshot = buildLeagueSnapshot(10, 5, standings, histories)!
    expect(snapshot.my_rank).toBe(2)
    expect(snapshot.my_points).toBe(70)
    expect(snapshot.top5.map((m) => [m.entry_id, m.rank])).toEqual([[2, 1], [USER_ENTRY_ID, 2], [1, 3]])
  })

  it("returns null when the user has no result for the gameweek", () => {
    const histories = new Map([[1, history(5, 70, 300)]])
    expect(buildLeagueSnapshot(10, 5, [standing(1), standing(USER_ENTRY_ID)], histories)).toBeNull()
  })
})
