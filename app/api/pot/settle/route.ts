import { settlePot } from "@/lib/pot-db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const throughGw = Number(body?.throughGw);

    if (!Number.isFinite(throughGw) || throughGw < 1) {
      return NextResponse.json({ error: "Invalid throughGw" }, { status: 400 });
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
