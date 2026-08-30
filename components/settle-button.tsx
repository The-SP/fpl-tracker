"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SettleButton({ throughGw }: { throughGw: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSettle = async () => {
    if (!confirm(`Mark the pot settled through GW ${throughGw}? This resets balances to zero from GW ${throughGw + 1}.`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/pot/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ throughGw }),
      });
      if (!response.ok) {
        throw new Error("Failed to settle");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSettle}
        disabled={loading}
        className="rounded-lg border-2 border-[#1B5E3F] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-[#1B5E3F] transition hover:bg-[#1B5E3F] hover:text-white disabled:opacity-60 dark:border-[#3FA968] dark:text-[#3FA968] dark:hover:bg-[#3FA968] dark:hover:text-[#0E1712]"
      >
        {loading ? "Settling…" : `Mark settled through GW ${throughGw}`}
      </button>
      {error && (
        <p className="font-mono text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
