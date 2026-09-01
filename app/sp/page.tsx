import { getLatestSnapshots, initializeDatabase, getHighestPointsPerLeague } from "@/lib/db";
import { CheckLiveRankButton } from "@/components/check-live-rank-button";
import { RankBadge } from "@/components/rank-badge";
import Link from "next/link";
import { TRACKED_LEAGUES } from "@/config/leagues";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { FetchSnapshotButton } from "@/components/fetch-snapshot-button";

async function getHomePageData() {
  await initializeDatabase();
  const snapshots = await getLatestSnapshots();
  const highestPoints = await getHighestPointsPerLeague();
  return { snapshots, highestPoints };
}

export default async function Page() {
  const { snapshots, highestPoints } = await getHomePageData();

  const snapshotMap = new Map();
  snapshots.forEach((snapshot) => {
    snapshotMap.set(snapshot.league_id, snapshot);
  });

  const firstSnapshot = snapshots.length > 0 ? snapshots[0] : null;
  const gwHeader = firstSnapshot ? firstSnapshot.gw : "X";

  return (
    <div className="min-h-svh bg-[#F7F8F4] text-[#10201A] dark:bg-[#0E1712] dark:text-[#EDEFEA]">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Masthead */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#10201A] pb-5 dark:border-[#EDEFEA]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5B6B62] dark:text-[#8FA095]">
              Personal mini-league standings
            </p>
            <h1 className="font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
              Rank Tracker
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="standings" className="w-full">
          <TabsList className="h-auto w-full gap-1 rounded-lg bg-[#EAEBE4] p-1 dark:bg-[#16221B]">
            <TabsTrigger
              value="standings"
              className="rounded-md py-2 font-mono text-xs uppercase tracking-wide data-[state=active]:bg-[#1B5E3F] data-[state=active]:text-white"
            >
              League Standings
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="rounded-md py-2 font-mono text-xs uppercase tracking-wide data-[state=active]:bg-[#1B5E3F] data-[state=active]:text-white"
            >
              Live Rank Check
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="mt-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="font-mono text-xs text-[#5B6B62] dark:text-[#8FA095]">
                Fetch finalized gameweeks from FPL.
              </p>
              <FetchSnapshotButton />
            </div>
            {snapshots.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#D8DCD3] dark:border-[#24352B]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#D8DCD3] font-mono text-[11px] uppercase tracking-wider text-[#5B6B62] dark:border-[#24352B] dark:text-[#8FA095]">
                      <th className="px-4 py-3 text-left font-medium">League</th>
                      <th className="px-4 py-3 text-center font-medium">Rank</th>
                      <th className="px-4 py-3 text-center font-medium">
                        Pts (GW {gwHeader})
                      </th>
                      <th className="px-4 py-3 text-center font-medium">Best in league</th>
                      <th className="px-4 py-3 text-left font-medium">Updated</th>
                      <th className="px-4 py-3 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRACKED_LEAGUES.map((league) => {
                      const snapshot = snapshotMap.get(league.id);
                      const highest = highestPoints.get(league.id);

                      return (
                        <tr
                          key={league.id}
                          className="border-b border-[#EAEBE4] last:border-0 hover:bg-[#EFF1EA] dark:border-[#1B241D] dark:hover:bg-[#131E17]"
                        >
                          <td className="px-4 py-3 font-medium">{league.name}</td>
                          <td className="px-4 py-3 text-center">
                            {snapshot ? (
                              <RankBadge rank={snapshot.my_rank} className="mx-auto" />
                            ) : (
                              <span className="font-mono text-[#B9BEB2] dark:text-[#3A4A40]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold tabular-nums">
                            {snapshot ? snapshot.my_points : "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-mono tabular-nums text-[#5B6B62] dark:text-[#8FA095]">
                            {highest ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#5B6B62] dark:text-[#8FA095]">
                            {snapshot ? new Date(snapshot.fetched_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/sp/leagues/${league.id}`}
                              className="font-mono text-xs uppercase tracking-wide text-[#1B5E3F] hover:underline dark:text-[#3FA968]"
                            >
                              View &rarr;
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="mt-6">
            <CheckLiveRankButton />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-[#D8DCD3] p-8 text-center dark:border-[#24352B]">
      <p className="font-display text-xl font-bold uppercase tracking-tight">No data yet</p>
      <p className="mt-1 font-mono text-sm text-[#5B6B62] dark:text-[#8FA095]">
        Run the snapshot job to fetch data for finalized gameweeks.
      </p>
    </div>
  );
}
