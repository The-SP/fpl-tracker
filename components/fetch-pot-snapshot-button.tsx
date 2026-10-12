"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FetchPotSnapshotButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/pot/snapshot", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details || data.error || "Failed to fetch pot data");
      setMessage(data.skipped ? "Pot data was checked recently." : "Latest pot gameweeks fetched.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pot data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleFetch} disabled={loading}
        className="rounded-lg bg-turf-solid px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-turf-solid-hover disabled:opacity-60">
        {loading ? "Fetching…" : "Fetch latest pot data"}
      </button>
      {message && <p className="font-mono text-xs text-turf">{message}</p>}
      {error && <p className="font-mono text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
