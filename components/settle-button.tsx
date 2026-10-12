"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SettleButton({ throughGw }: { throughGw: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");

  const handleSettle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/pot/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ throughGw, token }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to settle");
      }
      setOpen(false);
      setToken("");
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
        className="rounded-lg border-2 border-turf px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-turf transition hover:bg-turf hover:text-page disabled:opacity-60"
      >
        {loading ? "Settling…" : `Mark settled through GW ${throughGw}`}
      </button>
      {error && !open && (
        <p className="font-mono text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !loading && setOpen(false)}
        >
          <form
            onSubmit={handleSettle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settle-dialog-title"
            className="w-full max-w-md rounded-xl border border-line bg-page p-6 text-ink shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="settle-dialog-title" className="font-display text-xl font-bold">
              Mark pot as settled?
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              This will settle the pot through GW {throughGw} and reset balances from GW {throughGw + 1} onward.
            </p>
            <label htmlFor="settle-token" className="mt-4 block font-mono text-xs uppercase tracking-wide text-ink-muted">
              Settlement token
            </label>
            <input
              id="settle-token"
              type="password"
              autoComplete="current-password"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm"
            />
            {error && (
              <p className="mt-2 font-mono text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={loading || !token}>
                {loading ? "Settling…" : "Confirm settlement"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
