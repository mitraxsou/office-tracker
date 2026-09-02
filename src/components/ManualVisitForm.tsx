"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTimeField, dateTimeLocalToIso } from "@/components/DateTimeField";

function CheckInIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
    </svg>
  );
}

function CheckOutIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16l4-4m0 0l-4-4m4 4H3" />
    </svg>
  );
}

export function ManualVisitForm({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [includeCheckout, setIncludeCheckout] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: dateTimeLocalToIso(startAt),
        endAt: includeCheckout && endAt ? dateTimeLocalToIso(endAt) : null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save visit");
      return;
    }
    setStartAt("");
    setEndAt("");
    setIncludeCheckout(false);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-medium">Manual visit</h2>
        <p className="mt-1 text-sm text-muted">
          Log a past office session when the agent missed it, or for guest Wi-Fi and Ethernet.
          Pick date and time from the calendar and clock controls.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckInIcon />
            <p className="text-sm font-medium">Check-in</p>
          </div>
          <DateTimeField
            label="When you arrived"
            value={startAt}
            onChange={setStartAt}
            required
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={includeCheckout}
            onChange={(e) => {
              setIncludeCheckout(e.target.checked);
              if (!e.target.checked) setEndAt("");
            }}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Add check-out time</span>
            <span className="mt-0.5 block text-xs text-muted">
              Leave unchecked for an open visit. The agent or a manual check-out can close it
              later.
            </span>
          </span>
        </label>

        {includeCheckout && (
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckOutIcon />
              <p className="text-sm font-medium">Check-out</p>
              <span className="rounded bg-[var(--pwc-orange-muted)] px-2 py-0.5 text-xs text-accent">
                Optional
              </span>
            </div>
            <DateTimeField label="When you left" value={endAt} onChange={setEndAt} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add manual visit"}
          </button>
          <p className="text-xs text-muted">Timezone: {timezone}</p>
        </div>
      </form>
    </section>
  );
}
