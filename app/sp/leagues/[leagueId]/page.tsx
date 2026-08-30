import { getLeagueSnapshots, initializeDatabase } from "@/lib/db";
import { TRACKED_LEAGUES } from "@/config/leagues";
import { RankBadge } from "@/components/rank-badge";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ leagueId: string }>;
}

async function getLeagueData(leagueIdNum: number) {
  await initializeDatabase();
  return getLeagueSnapshots(leagueIdNum);
}

export default async function LeagueDetailPage({ params }: Props) {
  const { leagueId } = await params;
  const leagueIdNum = parseInt(leagueId, 10);

  const league = TRACKED_LEAGUES.find((l) => l.id === leagueIdNum);
  if (!league) {
    notFound();
  }

  const snapshots = await getLeagueData(leagueIdNum);
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <div className="min-h-svh bg-[#F7F8F4] text-[#10201A] dark:bg-[#0E1712] dark:text-[#EDEFEA]">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div>
          <Link
            href="/sp"
            className="font-mono text-xs uppercase tracking-wide text-[#5B6B62] hover:text-[#1B5E3F] dark:text-[#8FA095] dark:hover:text-[#3FA969]"
          >
            &larr; All leagues
          </Link>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl">
            {league.name}
          </h1>
          {league.notes && (
            <p className="mt-1 font-mono text-sm text-[#5B6B62] dark:text-[#8FA095]">
              {league.notes}
            </p>
          )}
        </div>

        {snapshots.length === 0 || !latest ? (
          <div className="rounded-lg border-2 border-dashed border-[#D8DCD3] p-8 text-center dark:border-[#24352B]">
            <p className="font-display text-xl font-bold uppercase tracking-tight">
              No snapshots yet
            </p>
            <p className="mt-1 font-mono text-sm text-[#5B6B62] dark:text-[#8FA095]">
              Gameweek snapshots will appear here once they are finalized and fetched.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-3 divide-x divide-[#D8DCD3] rounded-lg border border-[#D8DCD3] dark:divide-[#24352B] dark:border-[#24352B]">
              <StatBlock label="Latest GW" value={latest.gw} accent="turf" />
              <StatBlock label="Current rank" value={`#${latest.my_rank}`} accent="gold" />
              <StatBlock label="Latest points" value={latest.my_points} accent="turf" />
            </div>

            <div>
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[#5B6B62] dark:text-[#8FA095]">
                Rank history
              </p>
              <div className="overflow-x-auto rounded-lg border border-[#D8DCD3] dark:border-[#24352B]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#D8DCD3] font-mono text-[11px] uppercase tracking-wider text-[#5B6B62] dark:border-[#24352B] dark:text-[#8FA095]">
                      <th className="px-4 py-3 text-left font-medium">GW</th>
                      <th className="px-4 py-3 text-center font-medium">Rank</th>
                      <th className="px-4 py-3 text-center font-medium">Points</th>
                      <th className="px-4 py-3 text-left font-medium">Top 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot) => (
                      <tr
                        key={`${snapshot.league_id}-${snapshot.gw}`}
                        className="border-b border-[#EAEBE4] align-top last:border-0 dark:border-[#1B241D]"
                      >
                        <td className="px-4 py-4">
                          <span className="inline-block rounded border border-[#D8DCD3] px-2 py-0.5 font-mono text-xs font-semibold dark:border-[#24352B]">
                            GW {snapshot.gw}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <RankBadge rank={snapshot.my_rank} className="mx-auto" />
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-semibold tabular-nums">
                          {snapshot.my_points}
                        </td>
                        <td className="px-4 py-4">
                          <ol className="space-y-1.5">
                            {snapshot.top5.map((manager) => (
                              <li
                                key={manager.entry_id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <RankBadge rank={manager.rank} size="sm" />
                                <a
                                  href={`https://fantasy.premierleague.com/entry/${manager.entry_id}/event/${snapshot.gw}`}
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
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "turf" | "gold";
}) {
  const accentColor =
    accent === "turf"
      ? "text-[#1B5E3F] dark:text-[#3FA968]"
      : "text-[#8A5A0F] dark:text-[#E4B448]";

  return (
    <div className="px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[#5B6B62] dark:text-[#8FA095]">
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-black tabular-nums ${accentColor}`}>
        {value}
      </p>
    </div>
  );
}
