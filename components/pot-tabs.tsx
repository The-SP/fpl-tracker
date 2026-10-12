"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { RankBadge } from "@/components/rank-badge";
import { SettleButton } from "@/components/settle-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fplEventUrl } from "@/lib/fpl";
import type { PotGwResult, PotOverallResult, PotBalance, PotSettlement } from "@/lib/pot-db";

interface WeeklyResults {
  gw: number;
  results: PotGwResult[];
}

interface PotTabsProps {
  weeklyResults: WeeklyResults[];
  overallResults: PotOverallResult[];
  balances: PotBalance[];
  lastSettlement: PotSettlement | null;
  entryFee: number;
  latestFinalGw: number | null;
}

const TAB_TRIGGER_CLASS =
  "rounded-md py-3 font-mono text-xs uppercase tracking-wide data-active:bg-turf-solid data-active:text-white dark:data-active:bg-turf-solid dark:data-active:text-white";
const TABLE_CLASS = "w-full border-collapse text-sm [&_tbody_tr:hover]:bg-row-hover";
const PILL_CLASS = "rounded-md px-3 py-3 font-mono text-xs uppercase tracking-wide";

function formatRs(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

export function PotTabs({ weeklyResults, overallResults, balances, lastSettlement, entryFee, latestFinalGw }: PotTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") === "pot" ? "pot" : "results";
  const latestGw = weeklyResults[0]?.gw;
  const [selectedGw, setSelectedGw] = useState<number | "overall">(latestGw ?? "overall");
  const selectedWeek = typeof selectedGw === "number"
    ? weeklyResults.find((week) => week.gw === selectedGw)
    : undefined;
  const winnerRows = weeklyResults.flatMap(({ results }) => results.filter((r) => r.is_winner));
  const canSettle =
    latestFinalGw !== null && latestFinalGw > (lastSettlement?.settled_through_gw ?? 0);

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "results") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="min-h-14 h-auto w-full gap-1 rounded-lg bg-rail p-1">
        <TabsTrigger value="results" className={TAB_TRIGGER_CLASS}>
          Weekly Results
        </TabsTrigger>
        <TabsTrigger value="pot" className={TAB_TRIGGER_CLASS}>
          Pot / Balance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="mt-6">
        {weeklyResults.length === 0 ? (
          <EmptyState text="No gameweeks fetched yet. Run the pot snapshot job to fetch finalized or live gameweeks." />
        ) : (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-line">
              <div className="border-b bg-row-hover px-4 py-2 font-mono text-xs font-semibold uppercase">Winners</div>
              <table className={TABLE_CLASS}>
                <thead>
                  <tr className="border-b font-mono text-[11px] uppercase">
                    <th className="px-4 py-3 text-left">GW</th>
                    <th className="px-4 py-3 text-left">Winner</th>
                    <th className="px-4 py-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {winnerRows.map((r) => (
                    <tr key={`${r.gw}-${r.entry_id}`} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono">
                        <span className="inline-flex items-center gap-2">
                          {!r.is_final && (
                            <span
                              aria-label="Live gameweek"
                              title="Live gameweek"
                              className="inline-block h-2.5 w-2.5 rounded-full bg-turf shadow-[0_0_0_3px_rgba(27,94,63,0.15)]"
                            />
                          )}
                          GW {r.gw}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ManagerLinks href={fplEventUrl(r.entry_id, r.gw)} playerName={r.player_name} entryName={r.entry_name} />
                        {!r.is_final && (
                          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Live GW, winner may change.</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{r.points} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-rail p-1">
              <button
                type="button"
                onClick={() => setSelectedGw("overall")}
                className={`${PILL_CLASS} ${selectedGw === "overall" ? "bg-turf-solid text-white" : ""}`}
              >
                Overall
              </button>
              {weeklyResults.map(({ gw }) => (
                <button
                  key={gw}
                  type="button"
                  onClick={() => setSelectedGw(gw)}
                  className={`${PILL_CLASS} ${selectedGw === gw ? "bg-turf-solid text-white" : ""}`}
                >
                  GW {gw}
                </button>
              ))}
            </div>

            {selectedGw === "overall" && overallResults.length > 0 && (
              <>
                {overallResults.some((r) => !r.is_final) && (
                  <LiveBanner title="Overall · Live provisional ranking">
                    This table includes the current live gameweek and may change before it is finalized.
                  </LiveBanner>
                )}
                <RankingTable
                  rows={overallResults.map((r) => ({
                    entryId: r.entry_id,
                    rank: r.rank,
                    playerName: r.player_name,
                    entryName: r.entry_name,
                    points: r.points,
                    href: fplEventUrl(r.entry_id, r.latest_gw),
                  }))}
                />
              </>
            )}

            {selectedWeek && (
              <>
                {selectedWeek.results.some((r) => !r.is_final) && (
                  <LiveBanner title={`GW ${selectedWeek.gw} · Live provisional ranking`}>
                    This gameweek is still in progress. Points, bonus points, and the winner may change before it is finalized.
                  </LiveBanner>
                )}
                <RankingTable
                  rows={selectedWeek.results.map((r) => ({
                    entryId: r.entry_id,
                    rank: r.rank,
                    playerName: r.player_name,
                    entryName: r.entry_name,
                    points: r.points,
                    href: fplEventUrl(r.entry_id, r.gw),
                  }))}
                />
              </>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="pot" className="mt-6 space-y-6">
        {balances.length === 0 ? (
          <EmptyState text="No unsettled results yet." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className={TABLE_CLASS}>
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-center font-medium">GWs won</th>
                  <th className="px-4 py-3 text-center font-medium">Wins</th>
                  <th className="px-4 py-3 text-right font-medium">Net (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.entry_id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <ManagerLinks href={fplEventUrl(b.entry_id, b.latest_gw)} playerName={b.player_name} entryName={b.entry_name} />
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">
                      {b.won_gws.map((gw) => (
                        <a
                          key={gw}
                          href={fplEventUrl(b.entry_id, gw)}
                          target="_blank"
                          rel="noreferrer"
                          className="mr-1 inline-block rounded border px-2 py-0.5 text-xs hover:bg-rail"
                        >
                          GW {gw}
                        </a>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">{b.wins}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                        b.net > 0 ? "text-turf" : b.net < 0 ? "text-red-600 dark:text-red-400" : ""
                      }`}
                    >
                      {formatRs(b.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
          <p className="font-mono text-xs text-ink-muted">
            {lastSettlement
              ? `Settled through GW ${lastSettlement.settled_through_gw}. Showing balances since then.`
              : "Never settled. Showing balances from the start."}
          </p>
          {canSettle && <SettleButton throughGw={latestFinalGw} />}
        </div>
        <p className="font-mono text-[11px] text-ink-muted">
          Rs {entryFee} per person per gameweek. Positive net = owed to them, negative = owes the pot.
        </p>
      </TabsContent>
    </Tabs>
  );
}

function ManagerLinks({ href, playerName, entryName }: { href: string; playerName: string; entryName: string }) {
  return (
    <>
      <a href={href} target="_blank" rel="noreferrer" className="text-inherit hover:underline">
        {playerName}
      </a>
      <div className="text-xs text-ink-muted">
        <a href={href} target="_blank" rel="noreferrer" className="text-inherit hover:underline">
          {entryName}
        </a>
      </div>
    </>
  );
}

interface RankingRow {
  entryId: number;
  rank: number;
  playerName: string;
  entryName: string;
  points: number;
  href: string;
}

function RankingTable({ rows }: { rows: RankingRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className={TABLE_CLASS}>
        <thead>
          <tr className="border-b font-mono text-[11px] uppercase">
            <th className="w-12 px-4 py-3 text-left">Rank</th>
            <th className="px-2 py-3 text-left">Manager</th>
            <th className="px-4 py-3 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.entryId} className="border-b border-line-soft last:border-0">
              <td className="w-12 px-4 py-2.5">
                <RankBadge rank={row.rank} size="sm" />
              </td>
              <td className="px-2 py-2.5 font-medium">
                <ManagerLinks href={row.href} playerName={row.playerName} entryName={row.entryName} />
              </td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold">{row.points} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveBanner({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-amber-500 bg-amber-100 px-4 py-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-mono text-sm font-bold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-line p-8 text-center">
      <p className="font-mono text-sm text-ink-muted">{text}</p>
    </div>
  );
}
