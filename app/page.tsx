import { Suspense } from "react";
import {
  getAllPotResultsByGw,
  getLastSettlement,
  getPotBalances,
} from "@/lib/pot-db";
import { initializeDatabase } from "@/lib/db";
import { POT_ENTRY_FEE } from "@/config/pot";
import { PotTabs } from "@/components/pot-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { FetchPotSnapshotButton } from "@/components/fetch-pot-snapshot-button";

async function getPotPageData() {
  await initializeDatabase();
  const byGw = await getAllPotResultsByGw();
  const lastSettlement = await getLastSettlement();
  const sinceGw = lastSettlement?.settled_through_gw ?? 0;
  const balances = await getPotBalances(sinceGw, POT_ENTRY_FEE);

  const weeklyResults = Array.from(byGw.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([gw, results]) => ({ gw, results }));

  return { weeklyResults, balances, lastSettlement };
}

export default async function Page() {
  const { weeklyResults, balances, lastSettlement } = await getPotPageData();

  return (
    <div className="min-h-svh bg-[#F7F8F4] text-[#10201A] dark:bg-[#0E1712] dark:text-[#EDEFEA]">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#10201A] pb-5 dark:border-[#EDEFEA]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5B6B62] dark:text-[#8FA095]">
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
            balances={balances}
            lastSettlement={lastSettlement}
            entryFee={POT_ENTRY_FEE}
          />
          <FetchPotSnapshotButton />
        </Suspense>
      </div>
    </div>
  );
}
