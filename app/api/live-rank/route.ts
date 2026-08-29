import { getLiveRankForLeague, getLiveRankForAllLeagues } from "@/lib/live-rank";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const leagueIdParam = request.nextUrl.searchParams.get("leagueId");

    if (leagueIdParam) {
      // Get live rank for a specific league
      const leagueId = parseInt(leagueIdParam, 10);
      if (isNaN(leagueId)) {
        return NextResponse.json(
          { error: "Invalid leagueId parameter" },
          { status: 400 }
        );
      }

      const result = await getLiveRankForLeague(leagueId);
      return NextResponse.json(result);
    } else {
      // Get live rank for all leagues
      const results = await getLiveRankForAllLeagues();
      return NextResponse.json({ leagues: results });
    }
  } catch (error) {
    console.error("Live rank error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch live rank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
