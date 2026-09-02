"use client";

import { useCallback, useEffect, useState } from "react";

type OooRange = {
  id: string;
  startDate: string;
  endDate: string;
  source: string;
  createdAt: string;
};

function formatRangeLabel(startDate: string, endDate: string) {
  if (startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
}

export function OutOfOfficeSection({ adminUserId }: { adminUserId?: string } = {}) {
  const apiUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/out-of-office`
    : "/api/settings/out-of-office";
  const [todayKey, setTodayKey] = useState("");
  const [isOutToday, setIsOutToday] = useState(false);
  const [ranges, setRanges] = useState<OooRange[]>([]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      setError("Failed to load out-of-office status");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTodayKey(data.todayKey);
    setIsOutToday(data.isOutToday);
    setRanges(data.ranges ?? []);
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  async function postOoo(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed");
      return;
    }
    const data = await res.json();
    setTodayKey(data.todayKey);
    setIsOutToday(data.isOutToday);
    setRanges(data.ranges ?? []);
    return data;
  }

  async function updateToday(action: "mark" | "clear") {
    await postOoo({ action });
    setMessage(action === "mark" ? "Marked out of office for today." : "Cleared out of office for today.");
  }

  async function scheduleRange() {
    if (!rangeStart || !rangeEnd) return;
    await postOoo({ action: "add_range", startDate: rangeStart, endDate: rangeEnd });
    setMessage("Out-of-office range scheduled.");
    setRangeStart("");
    setRangeEnd("");
  }

  async function removeRange(rangeId: string) {
    await postOoo({ action: "remove", rangeId });
    setMessage("Out-of-office range removed.");
  }

  if (loading) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Loading out-of-office status...</p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">
        {adminUserId ? "Out of office (admin)" : "Out of office"}
      </h2>
      <p className="mb-4 text-sm text-muted">
        Schedule date ranges when you are away (leave, travel, WFH without laptop). No reminder or
        agent health alerts are sent during those days. Alert emails and Teams messages include a
        one-click link to mark yourself out for that day.
      </p>

      <div className="rounded-lg border border-[var(--border)] p-4">
        <p className="text-sm font-medium">Today ({todayKey})</p>
        <p className="mt-1 text-sm text-muted">
          {isOutToday
            ? "You are out of office today - no alerts for today."
            : "You are not out of office today."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isOutToday ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateToday("mark")}
              className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Mark out today
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateToday("clear")}
              className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Clear for today
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">Schedule a date range</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-muted">From</span>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="picker-input mt-1 block rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted">To</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="picker-input mt-1 block rounded-lg border px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={busy || !rangeStart || !rangeEnd}
            onClick={scheduleRange}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Schedule range
          </button>
        </div>
      </div>

      {ranges.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Scheduled out-of-office ranges</p>
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
            {ranges.map((r) => {
              const coversToday =
                r.startDate <= todayKey && todayKey <= r.endDate;
              return (
                <li key={r.id} className="flex items-center justify-between px-3 py-2">
                  <span>
                    {formatRangeLabel(r.startDate, r.endDate)}
                    {coversToday && (
                      <span className="ml-2 text-xs text-accent">(includes today)</span>
                    )}
                    <span className="ml-2 text-xs text-muted">via {r.source}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeRange(r.id)}
                    className="text-xs text-red-400 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
