import { Suspense } from "react";
import {
  getAllPotResultsByGw,
  getOverallPotResults,
  getLastSettlement,
  getLatestFinalPotGw,
  getPotBalances,
} from "@/lib/pot-db";
import { initializeDatabase } from "@/lib/db";
import { POT_ENTRY_FEE } from "@/config/pot";
import { PotTabs } from "@/components/pot-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { FetchPotSnapshotButton } from "@/components/fetch-pot-snapshot-button";

async function getPotPageData() {
  await initializeDatabase();
  const [byGw, overallResults, lastSettlement, latestFinalGw] = await Promise.all([
    getAllPotResultsByGw(),
    getOverallPotResults(),
    getLastSettlement(),
    getLatestFinalPotGw(),
  ]);
  const balances = await getPotBalances(lastSettlement?.settled_through_gw ?? 0, POT_ENTRY_FEE);

  const weeklyResults = Array.from(byGw.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([gw, results]) => ({ gw, results }));

  return { weeklyResults, overallResults, balances, lastSettlement, latestFinalGw };
}

export default async function Page() {
  const { weeklyResults, overallResults, balances, lastSettlement, latestFinalGw } = await getPotPageData();

  return (
    <div className="min-h-svh bg-page text-ink">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 border-b-2 border-ink pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
              FPL &middot; Rs {POT_ENTRY_FEE}/week, winner takes all
            </p>
            <h1 className="font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
              Weekly Pot
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <Suspense fallback={null}>
          <PotTabs
            weeklyResults={weeklyResults}
            overallResults={overallResults}
            balances={balances}
            lastSettlement={lastSettlement}
            entryFee={POT_ENTRY_FEE}
            latestFinalGw={latestFinalGw}
          />
          <FetchPotSnapshotButton />
        </Suspense>
      </div>
    </div>
  );
}
