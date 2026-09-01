import { runPotSnapshotJob } from "@/lib/pot-snapshot";
import {
  getLatestPotSnapshotCall,
  recordPotSnapshotCall,
} from "@/lib/pot-db";
import { initializeDatabase } from "@/lib/db";
import { NextResponse } from "next/server";

const POT_SNAPSHOT_COOLDOWN_HOURS = 3;

async function handle() {
  try {
    await initializeDatabase();
    const latestCall = await getLatestPotSnapshotCall();
    if (latestCall) {
      const elapsedHours = (Date.now() - new Date(latestCall).getTime()) / (1000 * 60 * 60);
      if (elapsedHours < POT_SNAPSHOT_COOLDOWN_HOURS) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `Pot snapshot checked recently. Try again after ${POT_SNAPSHOT_COOLDOWN_HOURS} hours.`,
          calledAt: latestCall,
        });
      }
    }

    const calledAt = new Date().toISOString();
    await runPotSnapshotJob();
    await recordPotSnapshotCall(calledAt);
    return NextResponse.json({ success: true, skipped: false, message: "Pot snapshot job completed", calledAt });
  } catch (error) {
    console.error("Pot snapshot error:", error);
    return NextResponse.json(
      {
        error: "Pot snapshot job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const POST = handle;
export const GET = handle;
