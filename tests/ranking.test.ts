import { describe, expect, it } from "vitest"
import { competitionRank } from "@/lib/ranking"

const ranksOf = (scores: number[]) =>
  competitionRank(scores, (score) => score).map(({ item, rank }) => [item, rank])

describe("competitionRank", () => {
  it("sorts descending and ranks distinct scores", () => {
    expect(ranksOf([40, 70, 55])).toEqual([[70, 1], [55, 2], [40, 3]])
  })

  it("shares ranks for ties of any size and skips ahead", () => {
    expect(ranksOf([60, 60, 60, 50, 50, 10])).toEqual([
      [60, 1], [60, 1], [60, 1], [50, 4], [50, 4], [10, 6],
    ])
  })

  it("keeps input order within ties", () => {
    const rows = [{ id: "a", p: 5 }, { id: "b", p: 9 }, { id: "c", p: 5 }]
    expect(competitionRank(rows, (r) => r.p).map(({ item }) => item.id)).toEqual(["b", "a", "c"])
  })

  it("handles empty input", () => {
    expect(competitionRank([], () => 0)).toEqual([])
  })
})
