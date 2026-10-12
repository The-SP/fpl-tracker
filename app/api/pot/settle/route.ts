import { createHash, timingSafeEqual } from "node:crypto";
import { getLastSettlement, getLatestFinalPotGw, settlePot } from "@/lib/pot-db";
import { initializeDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Used when POT_SETTLE_TOKEN is not set.
const DEFAULT_SETTLE_TOKEN = "settle";

function tokenMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") return false;
  // Hash both sides so the comparison is constant-time regardless of length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.POT_SETTLE_TOKEN || DEFAULT_SETTLE_TOKEN;

    const body = await request.json().catch(() => null);
    if (!tokenMatches(body?.token, expectedToken)) {
      return NextResponse.json({ error: "Invalid settlement token" }, { status: 401 });
    }

    const throughGw = Number(body?.throughGw);
    if (!Number.isInteger(throughGw) || throughGw < 1) {
      return NextResponse.json({ error: "Invalid throughGw" }, { status: 400 });
    }

    await initializeDatabase();
    const [lastSettlement, latestFinalGw] = await Promise.all([
      getLastSettlement(),
      getLatestFinalPotGw(),
    ]);

    if (lastSettlement && throughGw <= lastSettlement.settled_through_gw) {
      return NextResponse.json(
        { error: `Already settled through GW ${lastSettlement.settled_through_gw}` },
        { status: 409 }
      );
    }
    if (latestFinalGw === null || throughGw > latestFinalGw) {
      return NextResponse.json(
        { error: `GW ${throughGw} is not final yet` },
        { status: 400 }
      );
    }

    await settlePot(throughGw);
    return NextResponse.json({ success: true, settled_through_gw: throughGw });
  } catch (error) {
    console.error("Pot settle error:", error);
    return NextResponse.json(
      {
        error: "Failed to settle pot",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
