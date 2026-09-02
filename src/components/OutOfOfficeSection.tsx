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
    setMessage(
      action === "mark" ? "Set out of office for today." : "Cleared out of office for today.",
    );
  }

  async function scheduleRange() {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return;
    await postOoo({ action: "add_range", startDate: rangeStart, endDate: rangeEnd });
    setMessage(
      rangeStart === rangeEnd
        ? `Scheduled out of office on ${rangeStart}.`
        : `Scheduled out of office from ${rangeStart} to ${rangeEnd}.`,
    );
    setRangeStart("");
    setRangeEnd("");
  }

  async function removeRange(rangeId: string) {
    await postOoo({ action: "remove", rangeId });
    setMessage("Removed scheduled out of office.");
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
        Mark days away from the office (leave, travel, WFH without the laptop). No reminders or
        agent health alerts are sent on those days, and they do not count against compliance.
      </p>

      <div
        className={`rounded-lg border p-4 ${
          isOutToday
            ? "border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange-muted)]/30"
            : "border-[var(--border)]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Today ({todayKey})</p>
            <p className="mt-1 text-sm text-muted">
              {isOutToday
                ? "Marked out of office. No alerts today."
                : "Not marked out of office."}
            </p>
          </div>
          {!isOutToday ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateToday("mark")}
              className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Set out of office today
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateToday("clear")}
              className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Clear out of office
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
        <p className="text-sm font-medium">Schedule out of office</p>
        <p className="mt-1 mb-3 text-xs text-muted">
          Pick the first and last day you are away. Both days are included.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">First day away</span>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => {
                setRangeStart(e.target.value);
                if (rangeEnd && e.target.value > rangeEnd) setRangeEnd(e.target.value);
              }}
              className="picker-input block rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Last day away</span>
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart || undefined}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="picker-input block rounded-lg border px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={busy || !rangeStart || !rangeEnd || rangeStart > rangeEnd}
            onClick={scheduleRange}
            className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
          >
            Schedule out of office
          </button>
        </div>
        {rangeStart && rangeEnd && rangeStart > rangeEnd && (
          <p className="mt-2 text-xs text-red-400">Last day must be on or after the first day.</p>
        )}
      </div>

      {ranges.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Scheduled days away</p>
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
