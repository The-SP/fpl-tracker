"use client";

import { useState } from "react";
import { RankBadge } from "@/components/rank-badge";
import type { LiveRankResult } from "@/lib/live-rank";

export function CheckLiveRankButton() {
  const [loading, setLoading] = useState(false);
  const [liveRanks, setLiveRanks] = useState<LiveRankResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckLiveRank = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/live-rank");
      if (!response.ok) {
        throw new Error("Failed to fetch live ranks");
      }
      const data = await response.json();
      setLiveRanks(data.leagues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const currentGw = liveRanks?.[0]?.current_gw ?? null;

  return (
    <div className="space-y-5">
      <button
        onClick={handleCheckLiveRank}
        disabled={loading}
        className="w-full rounded-lg bg-[#1B5E3F] py-3 font-mono text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[#164D33] disabled:opacity-60"
      >
        {loading ? "Checking…" : liveRanks ? "Refresh live rank" : "Check live rank now"}
      </button>

      {currentGw !== null && (
        <div className="rounded-lg border border-[#D8DCD3] bg-[#F5F6F1] px-3 py-2 text-right dark:border-[#24352B] dark:bg-[#111C17]">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5B6B62] dark:text-[#8FA095]">
            Current GW
          </span>
          <div className="mt-1 font-mono text-lg font-semibold text-[#1B5E3F] dark:text-[#3FA968]">
            {currentGw}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40">
          <p className="font-mono text-xs uppercase tracking-wide text-red-800 dark:text-red-300">
            Error
          </p>
          <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {liveRanks && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA968] opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1B5E3F]" />
            </span>
            <p className="font-mono text-xs uppercase tracking-wide text-[#5B6B62] dark:text-[#8FA095]">
              Live — bonus points not yet final
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#D8DCD3] dark:border-[#24352B]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#D8DCD3] font-mono text-[11px] uppercase tracking-wider text-[#5B6B62] dark:border-[#24352B] dark:text-[#8FA095]">
                  <th className="px-4 py-3 text-left font-medium">League</th>
                  <th className="px-4 py-3 text-center font-medium">Rank</th>
                  <th className="px-4 py-3 text-center font-medium">Points</th>
                  <th className="px-4 py-3 text-left font-medium">Top 5</th>
                </tr>
              </thead>
              <tbody>
                {liveRanks.map((league) => (
                  <tr
                    key={league.league_id}
                    className="border-b border-[#EAEBE4] align-top last:border-0 dark:border-[#1B241D]"
                  >
                    <td className="px-4 py-4 font-medium">{league.league_name}</td>
                    <td className="px-4 py-4 text-center">
                      <RankBadge rank={league.my_rank} className="mx-auto" />
                    </td>
                    <td className="px-4 py-4 text-center font-mono font-semibold tabular-nums">
                      {league.my_points}
                    </td>
                    <td className="px-4 py-4">
                      <ol className="space-y-1.5">
                        {league.top5.map((manager) => (
                          <li key={manager.entry_id} className="flex items-center gap-2 text-sm">
                            <RankBadge rank={manager.rank} size="sm" />
                            <a
                              href={`https://fantasy.premierleague.com/en/entry/${manager.entry_id}/event/${league.current_gw}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1B5E3F] hover:underline dark:text-[#3FA968]"
                            >
                              {manager.name}
                            </a>
                            <span className="font-mono text-xs text-[#5B6B62] dark:text-[#8FA095]">
                              {manager.points}pts
                            </span>
                          </li>
                        ))}
                      </ol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
