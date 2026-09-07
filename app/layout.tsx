import { Big_Shoulders, IBM_Plex_Mono, Montserrat } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

// All pages read live data from the database; render them per request.
export const dynamic = "force-dynamic"

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans" })

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
  variable: "--font-display",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", display.variable, plexMono.variable, "font-sans", montserrat.variable)}
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
