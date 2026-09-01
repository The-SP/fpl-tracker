"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { RankBadge } from "@/components/rank-badge";
import { SettleButton } from "@/components/settle-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PotGwResult, PotBalance, PotSettlement } from "@/lib/pot-db";

interface WeeklyResults {
  gw: number;
  results: PotGwResult[];
}

interface PotTabsProps {
  weeklyResults: WeeklyResults[];
  balances: PotBalance[];
  lastSettlement: PotSettlement | null;
  entryFee: number;
}

const CHIP_LABELS: Record<string, string> = {
  wildcard: "WC",
  freehit: "FH",
  bboost: "BB",
  "3xc": "TC",
  manager: "AM",
};

function chipLabel(chip: string | null): string | null {
  if (!chip) return null;
  return CHIP_LABELS[chip] ?? chip.toUpperCase();
}

export function PotTabs({ weeklyResults, balances, lastSettlement, entryFee }: PotTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") === "pot" ? "pot" : "results";
  const latestGw = weeklyResults[0]?.gw;
  const [selectedGw, setSelectedGw] = useState(latestGw);
  const selectedWeek = weeklyResults.find((week) => week.gw === selectedGw);
  const winnerRows = Array.from(
    new Map(
      weeklyResults
        .flatMap(({ gw, results }) =>
          results
            .filter((r) => r.is_winner)
            .map((r) => [`${gw}-${r.entry_id}`, { ...r, gw }] as const),
        ),
    ).values(),
  );

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
      <TabsList className="h-auto w-full gap-1 rounded-lg bg-[#EAEBE4] p-1 dark:bg-[#16221B]">
        <TabsTrigger
          value="results"
          className="rounded-md py-2 font-mono text-xs uppercase tracking-wide data-[state=active]:bg-[#1B5E3F] data-[state=active]:text-white"
        >
          Weekly Results
        </TabsTrigger>
        <TabsTrigger
          value="pot"
          className="rounded-md py-2 font-mono text-xs uppercase tracking-wide data-[state=active]:bg-[#1B5E3F] data-[state=active]:text-white"
        >
          Pot / Balance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="mt-6">
        {weeklyResults.length === 0 ? (
          <EmptyState text="No gameweeks snapshotted yet. Run the pot snapshot job to fetch finalized gameweeks." />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-1 rounded-lg bg-[#EAEBE4] p-1 dark:bg-[#16221B]">
              {weeklyResults.map(({ gw }) => (
                <button key={gw} type="button" onClick={() => setSelectedGw(gw)} className={`rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wide ${selectedGw === gw ? "bg-[#1B5E3F] text-white" : ""}`}>GW {gw}</button>
              ))}
            </div>
            {selectedWeek && (
              <div className="overflow-hidden rounded-lg border border-[#D8DCD3] dark:border-[#24352B]">
                <table className="w-full border-collapse text-sm [&_tbody_tr:hover]:bg-[#EFF1EA] dark:[&_tbody_tr:hover]:bg-[#131E17]"><tbody>
                  {selectedWeek.results.map((r) => (
                    <tr key={r.entry_id} onClick={() => window.open(`https://fantasy.premierleague.com/en/entry/${r.entry_id}/event/${r.gw}`, "_blank")} className="cursor-pointer border-b border-[#EAEBE4] last:border-0 dark:border-[#1B241D]"><td className="w-12 px-4 py-2.5"><RankBadge rank={r.rank} size="sm" /></td><td className="px-2 py-2.5 font-medium"><a href={`https://fantasy.premierleague.com/en/entry/${r.entry_id}/event/${r.gw}`} target="_blank" rel="noreferrer" className="text-inherit hover:underline">{r.player_name}</a><div className="text-xs text-[#5B6B62] dark:text-[#8FA095]"><a href={`https://fantasy.premierleague.com/en/entry/${r.entry_id}/event/${r.gw}`} target="_blank" rel="noreferrer">{r.entry_name}</a></div></td><td className="px-4 py-2.5 text-right font-mono font-semibold">{r.points} pts</td></tr>
                  ))}
                </tbody></table>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-[#D8DCD3] dark:border-[#24352B]"><div className="border-b bg-[#EFF1EA] px-4 py-2 font-mono text-xs font-semibold uppercase dark:bg-[#131E17]">Winners</div><table className="w-full text-sm [&_tbody_tr:hover]:bg-[#EFF1EA] dark:[&_tbody_tr:hover]:bg-[#131E17]"><thead><tr className="border-b font-mono text-[11px] uppercase"><th className="px-4 py-3 text-left">GW</th><th className="px-4 py-3 text-left">Winner</th><th className="px-4 py-3 text-right">Points</th></tr></thead><tbody>{winnerRows.map((r) => <tr key={`${r.gw}-${r.entry_id}`} onClick={() => window.open(`https://fantasy.premierleague.com/en/entry/${r.entry_id}/event/${r.gw}`, "_blank")} className="cursor-pointer border-b last:border-0"><td className="px-4 py-3 font-mono">GW {r.gw}</td><td className="px-4 py-3"><a href={`https://fantasy.premierleague.com/en/entry/${r.entry_id}/event/${r.gw}`} target="_blank" rel="noreferrer" className="text-inherit hover:underline">{r.player_name}</a><div className="text-xs text-[#5B6B62] dark:text-[#8FA095]"><a href={`https://fantasy.premierleague.com/en/entry/${r.entry_id}/event/${r.gw}`} target="_blank" rel="noreferrer">{r.entry_name}</a></div></td><td className="px-4 py-3 text-right font-mono">{r.points} pts</td></tr>)}</tbody></table></div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="pot" className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D8DCD3] px-4 py-3 dark:border-[#24352B]">
          <p className="font-mono text-xs text-[#5B6B62] dark:text-[#8FA095]">
            {lastSettlement
              ? `Settled through GW ${lastSettlement.settled_through_gw}. Showing balances since then.`
              : "Never settled. Showing balances from the start."}
          </p>
          {latestGw && <SettleButton throughGw={latestGw} />}
        </div>

        {balances.length === 0 ? (
          <EmptyState text="No unsettled results yet." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#D8DCD3] dark:border-[#24352B]">
            <table className="w-full border-collapse text-sm [&_tbody_tr:hover]:bg-[#EFF1EA] dark:[&_tbody_tr:hover]:bg-[#131E17]">
              <thead>
                <tr className="border-b border-[#D8DCD3] font-mono text-[11px] uppercase tracking-wider text-[#5B6B62] dark:border-[#24352B] dark:text-[#8FA095]">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-center font-medium">GWs won</th>
                  <th className="px-4 py-3 text-center font-medium">Wins</th>
                  <th className="px-4 py-3 text-right font-medium">Net (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr
                    key={b.entry_id}
                    onClick={() => window.open(`https://fantasy.premierleague.com/en/entry/${b.entry_id}/history`, "_blank")}
                    className="cursor-pointer border-b border-[#EAEBE4] last:border-0 dark:border-[#1B241D]"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div><a href={`https://fantasy.premierleague.com/en/entry/${b.entry_id}/history`} target="_blank" rel="noreferrer" className="text-inherit hover:underline">{b.player_name}</a></div>
                      <div className="text-xs text-[#5B6B62] dark:text-[#8FA095]"><a href={`https://fantasy.premierleague.com/en/entry/${b.entry_id}/history`} target="_blank" rel="noreferrer">{b.entry_name}</a></div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">
                      {b.won_gws.map((gw) => <a key={gw} href={`https://fantasy.premierleague.com/en/entry/${b.entry_id}/event/${gw}`} target="_blank" rel="noreferrer" className="mr-1 inline-block rounded border px-2 py-0.5 text-xs hover:bg-[#EAEBE4] dark:hover:bg-[#24352B]">GW {gw}</a>)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">{b.wins}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                        b.net > 0
                          ? "text-[#1B5E3F] dark:text-[#3FA968]"
                          : b.net < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {b.net > 0 ? "+" : ""}
                      {b.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="font-mono text-[11px] text-[#5B6B62] dark:text-[#8FA095]">
          Rs {entryFee} per person per gameweek. Positive net = owed to them, negative = owes the pot.
        </p>
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-[#D8DCD3] p-8 text-center dark:border-[#24352B]">
      <p className="font-mono text-sm text-[#5B6B62] dark:text-[#8FA095]">{text}</p>
    </div>
  );
}
