import { runPotSnapshotJob } from "@/lib/pot-snapshot";
import { NextRequest, NextResponse } from "next/server";

async function handle(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runPotSnapshotJob();
    return NextResponse.json({ success: true, message: "Pot snapshot job completed" });
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

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
