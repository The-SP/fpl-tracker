import { runSnapshotJob } from "@/lib/snapshot";
import { getLatestSnapshotCall, initializeDatabase, recordSnapshotCall } from "@/lib/db";
import { NextResponse } from "next/server";

const SNAPSHOT_COOLDOWN_HOURS = 3;

async function handleSnapshot() {
  try {
    await initializeDatabase();
    const latestCall = await getLatestSnapshotCall();

    if (latestCall) {
      const elapsedHours = (Date.now() - new Date(latestCall).getTime()) / (1000 * 60 * 60);
      if (elapsedHours < SNAPSHOT_COOLDOWN_HOURS) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `Snapshot checked recently. Try again after ${SNAPSHOT_COOLDOWN_HOURS} hours.`,
          calledAt: latestCall,
        });
      }
    }

    const calledAt = new Date().toISOString();
    await runSnapshotJob();
    await recordSnapshotCall(calledAt);
    return NextResponse.json({ success: true, skipped: false, message: "Snapshot job completed", calledAt });
  } catch (error) {
    console.error("Manual snapshot error:", error);
    return NextResponse.json(
      {
        error: "Snapshot job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const GET = handleSnapshot;
export const POST = handleSnapshot;
