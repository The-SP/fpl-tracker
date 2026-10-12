import { getLatestSnapshots, initializeDatabase, type GWSnapshot } from "@/lib/db";
import { CheckLiveRankButton } from "@/components/check-live-rank-button";
import { RankBadge } from "@/components/rank-badge";
import Link from "next/link";
import { TRACKED_LEAGUES } from "@/config/leagues";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { FetchSnapshotButton } from "@/components/fetch-snapshot-button";

async function getHomePageData() {
  await initializeDatabase();
  return getLatestSnapshots();
}

export default async function Page() {
  const snapshots = await getHomePageData();
  const snapshotMap = new Map<number, GWSnapshot>(
    snapshots.map((snapshot) => [snapshot.league_id, snapshot])
  );

  const firstSnapshot = snapshots.length > 0 ? snapshots[0] : null;
  const gwHeader = firstSnapshot ? firstSnapshot.gw : "X";

  return (
    <div className="min-h-svh bg-page text-ink">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Masthead */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-ink pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
              Personal mini-league standings
            </p>
            <h1 className="font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
              Rank Tracker
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="standings" className="w-full">
          <TabsList className="h-auto w-full gap-1 rounded-lg bg-rail p-1">
            <TabsTrigger
              value="standings"
              className="rounded-md py-2 font-mono text-xs uppercase tracking-wide data-active:bg-turf-solid dark:data-active:bg-turf-solid data-active:text-white dark:data-active:text-white"
            >
              League Standings
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="rounded-md py-2 font-mono text-xs uppercase tracking-wide data-active:bg-turf-solid dark:data-active:bg-turf-solid data-active:text-white dark:data-active:text-white"
            >
              Live Rank Check
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="mt-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="font-mono text-xs text-ink-muted">
                Fetch finalized gameweeks from FPL.
              </p>
              <FetchSnapshotButton />
            </div>
            {snapshots.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                      <th className="px-4 py-3 text-left font-medium">League</th>
                      <th className="px-4 py-3 text-center font-medium">Rank</th>
                      <th className="px-4 py-3 text-center font-medium">
                        Pts (GW {gwHeader})
                      </th>
                      <th className="px-4 py-3 text-center font-medium">League GW best</th>
                      <th className="px-4 py-3 text-left font-medium">Updated</th>
                      <th className="px-4 py-3 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRACKED_LEAGUES.map((league) => {
                      const snapshot = snapshotMap.get(league.id);
                      const gwTopScore = snapshot?.top5.find((manager) => manager.rank === 1)?.points;

                      return (
                        <tr
                          key={league.id}
                          className="border-b border-line-soft last:border-0 hover:bg-row-hover"
                        >
                          <td className="px-4 py-3 font-medium">{league.name}</td>
                          <td className="px-4 py-3 text-center">
                            {snapshot ? (
                              <RankBadge rank={snapshot.my_rank} className="mx-auto" />
                            ) : (
                              <span className="font-mono text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold tabular-nums">
                            {snapshot ? snapshot.my_points : "—"}
                          </td>
                          <td className="px-4 py-3 text-center font-mono tabular-nums text-ink-muted">
                            {gwTopScore ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                            {snapshot ? new Date(snapshot.fetched_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/sp/leagues/${league.id}`}
                              className="font-mono text-xs uppercase tracking-wide text-turf hover:underline"
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
    <div className="rounded-lg border-2 border-dashed border-line p-8 text-center">
      <p className="font-display text-xl font-bold uppercase tracking-tight">No data yet</p>
      <p className="mt-1 font-mono text-sm text-ink-muted">
        Run the snapshot job to fetch data for finalized gameweeks.
      </p>
    </div>
  );
}
