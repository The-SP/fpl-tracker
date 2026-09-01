"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SettleButton({ throughGw }: { throughGw: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleSettle = async () => {
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
      setOpen(false);
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
        onClick={() => setOpen(true)}
        disabled={loading}
        className="rounded-lg border-2 border-[#1B5E3F] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-[#1B5E3F] transition hover:bg-[#1B5E3F] hover:text-white disabled:opacity-60 dark:border-[#3FA968] dark:text-[#3FA968] dark:hover:bg-[#3FA968] dark:hover:text-[#0E1712]"
      >
        {loading ? "Settling…" : `Mark settled through GW ${throughGw}`}
      </button>
      {error && (
        <p className="font-mono text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settle-dialog-title"
            className="w-full max-w-md rounded-xl border border-[#D8DCD3] bg-[#F7F8F4] p-6 text-[#10201A] shadow-xl dark:border-[#24352B] dark:bg-[#0E1712] dark:text-[#EDEFEA]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="settle-dialog-title" className="font-display text-xl font-bold">
              Mark pot as settled?
            </h2>
            <p className="mt-2 text-sm text-[#5B6B62] dark:text-[#8FA095]">
              This will settle the pot through GW {throughGw} and reset balances from GW {throughGw + 1} onward.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" variant="default" onClick={handleSettle} disabled={loading}>
                {loading ? "Settling…" : "Confirm settlement"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
