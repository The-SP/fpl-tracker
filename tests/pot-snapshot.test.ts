import { describe, expect, it } from "vitest"
import type { BootstrapData, BootstrapEvent, EntryHistory } from "@/lib/fpl"
import { buildPotGameweekResults, getPotGameweekStatuses } from "@/lib/pot-snapshot"
import type { PotMember } from "@/lib/pot-db"

function event(id: number, overrides: Partial<BootstrapEvent>): BootstrapEvent {
  return {
    id,
    name: `Gameweek ${id}`,
    deadline_time: "",
    average_entry_score: 0,
    finished: false,
    data_checked: false,
    is_current: false,
    is_next: false,
    ...overrides,
  }
}

function history(points: Record<number, number>): EntryHistory {
  return {
    current: Object.entries(points).map(([gw, p]) => ({ event: Number(gw), points: p, total_points: p })),
    chips: [],
  }
}

const member = (entryId: number, active = true): PotMember => ({
  entry_id: entryId,
  entry_name: `Team ${entryId}`,
  player_name: `Player ${entryId}`,
  active,
})

describe("getPotGameweekStatuses", () => {
  it("marks checked gameweeks final, started ones provisional, and skips future ones", () => {
    const bootstrap = {
      events: [
        event(1, { finished: true, data_checked: true }),
        event(2, { finished: true, data_checked: false }),
        event(3, { is_current: true }),
        event(4, { is_next: true }),
        event(5, {}),
      ],
    } as BootstrapData
    expect([...getPotGameweekStatuses(bootstrap)]).toEqual([[1, true], [2, false], [3, false]])
  })
})

describe("buildPotGameweekResults", () => {
  it("ranks ties together and marks all of them winners", () => {
    const members = [member(1), member(2), member(3), member(4)]
    const histories = new Map([
      [1, history({ 1: 60 })],
      [2, history({ 1: 75 })],
      [3, history({ 1: 75 })],
      [4, history({ 1: 75 })],
    ])
    const { results, missingIds } = buildPotGameweekResults(1, true, members, histories)
    expect(missingIds).toEqual([])
    expect(results.map((r) => [r.entry_id, r.rank, r.is_winner])).toEqual([
      [2, 1, true], [3, 1, true], [4, 1, true], [1, 4, false],
    ])
  })

  it("skips inactive members and reports members whose history is missing", () => {
    const members = [member(1), member(2, false), member(3), member(4)]
    const histories = new Map([
      [1, history({ 1: 60 })],
      [2, history({ 1: 99 })],
      // Entry 4 joined after GW 1.
      [4, history({ 2: 50 })],
    ])
    const { results, missingIds } = buildPotGameweekResults(1, false, members, histories)
    expect(results.map((r) => r.entry_id)).toEqual([1])
    expect(results[0].is_final).toBe(false)
    expect(missingIds).toEqual([3])
  })
})
