"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
            {weeklyResults.map(({ gw, results }) => (
              <div key={gw} className="overflow-hidden rounded-lg border border-[#D8DCD3] dark:border-[#24352B]">
                <div className="flex items-center justify-between border-b border-[#D8DCD3] bg-[#EFF1EA] px-4 py-2 dark:border-[#24352B] dark:bg-[#131E17]">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wide">
                    GW {gw}
                  </span>
                  {results.some((r) => r.is_winner) && (
                    <span className="font-mono text-xs text-[#8A5A0F] dark:text-[#E4B448]">
                      {results.filter((r) => r.is_winner).length > 1 ? "Shared win" : "Winner"}:{" "}
                      {results
                        .filter((r) => r.is_winner)
                        .map((r) => r.entry_name)
                        .join(" & ")}
                    </span>
                  )}
                </div>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {results.map((r) => (
                      <tr
                        key={r.entry_id}
                        className={`border-b border-[#EAEBE4] last:border-0 dark:border-[#1B241D] ${
                          r.is_winner ? "bg-[#FBF3DE] dark:bg-[#2A230F]" : ""
                        }`}
                      >
                        <td className="w-12 px-4 py-2.5">
                          <RankBadge rank={r.rank} size="sm" />
                        </td>
                        <td className="px-2 py-2.5 font-medium">
                          <div>{r.entry_name}</div>
                          <div className="text-xs text-[#5B6B62] dark:text-[#8FA095]">{r.player_name}</div>
                          {chipLabel(r.chip) && (
                            <span className="ml-2 rounded border border-[#D8DCD3] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#5B6B62] dark:border-[#24352B] dark:text-[#8FA095]">
                              {chipLabel(r.chip)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                          {r.points} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
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
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#D8DCD3] font-mono text-[11px] uppercase tracking-wider text-[#5B6B62] dark:border-[#24352B] dark:text-[#8FA095]">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-center font-medium">GWs played</th>
                  <th className="px-4 py-3 text-center font-medium">Wins</th>
                  <th className="px-4 py-3 text-right font-medium">Net (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr
                    key={b.entry_id}
                    className="border-b border-[#EAEBE4] last:border-0 dark:border-[#1B241D]"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div>{b.entry_name}</div>
                      <div className="text-xs text-[#5B6B62] dark:text-[#8FA095]">{b.player_name}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">
                      {b.gws_played}
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
