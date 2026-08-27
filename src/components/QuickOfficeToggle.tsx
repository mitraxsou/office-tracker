"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuickOfficeToggle({ inOfficeNow }: { inOfficeNow: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const endpoint = inOfficeNow ? "/api/visits/check-out" : "/api/visits/check-in";
    const res = await fetch(endpoint, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-4">
      <p className="text-sm text-muted">
        Auto Wi-Fi detection blocked? Use manual check-in when you arrive and check-out when you
        leave.
      </p>
      {error && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`mt-3 px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          inOfficeNow ? "btn-secondary" : "btn-primary"
        }`}
      >
        {loading
          ? "Saving..."
          : inOfficeNow
            ? "Check out (leaving office)"
            : "I'm in office (check in)"}
      </button>
    </div>
  );
}
