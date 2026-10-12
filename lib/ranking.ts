/**
 * Standard competition ranking ("1224"): equal scores share a rank and the
 * next distinct score skips ahead. Returns a new array sorted by score
 * descending, each item paired with its rank.
 */
export function competitionRank<T>(
  items: readonly T[],
  score: (item: T) => number
): Array<{ item: T; rank: number }> {
  const sorted = [...items].sort((a, b) => score(b) - score(a))
  let currentRank = 1

  return sorted.map((item, index) => {
    if (index > 0 && score(sorted[index - 1]) !== score(item)) {
      currentRank = index + 1
    }
    return { item, rank: currentRank }
  })
}
