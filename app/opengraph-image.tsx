import { ImageResponse } from "next/og"
import { initializeDatabase } from "@/lib/db"
import { getAllPotResultsByGw } from "@/lib/pot-db"

export const runtime = "nodejs"
export const alt = "FPL Tracker weekly pot winners"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  await initializeDatabase()
  const byGw = await getAllPotResultsByGw()
  const winners = Array.from(byGw.entries())
    .sort(([a], [b]) => b - a)
    .flatMap(([gw, results]) =>
      results
        .filter((result) => result.is_winner)
        .map((result) => ({ ...result, gw })),
    )
    .slice(0, 6)

  return new ImageResponse(
    (
      <div
        style={{
          background: "#F7F8F4",
          color: "#10201A",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial",
          height: "100%",
          padding: "72px 80px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>
          FPL · WEEKLY POT
        </div>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 800, margin: "12px 0 38px" }}>
          Winners
        </div>
        <div style={{ border: "1px solid #D8DCD3", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: "#EFF1EA", display: "flex", fontSize: 20, fontWeight: 700, padding: "18px 24px", textTransform: "uppercase" }}>
            Latest gameweeks
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {winners.length > 0 ? winners.map((winner) => (
              <div key={`${winner.gw}-${winner.entry_id}`} style={{ borderTop: "1px solid #D8DCD3", display: "flex", fontSize: 24, padding: "18px 24px" }}>
                <div style={{ display: "flex", width: 180 }}>GW {winner.gw}</div>
                <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
                  <div style={{ display: "flex" }}>{winner.player_name}</div>
                  <div style={{ color: "#5B6B62", display: "flex", fontSize: 17, marginTop: 4 }}>{winner.entry_name}</div>
                </div>
                <div style={{ display: "flex", width: 140, justifyContent: "flex-end" }}>{winner.points} pts</div>
              </div>
            )) : (
              <div style={{ color: "#5B6B62", display: "flex", fontSize: 24, padding: "28px 24px" }}>No winners yet</div>
            )}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
