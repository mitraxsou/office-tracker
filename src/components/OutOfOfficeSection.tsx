"use client";

import { useCallback, useEffect, useState } from "react";

type OooDay = { dayKey: string; source: string; createdAt: string };

export function OutOfOfficeSection({ adminUserId }: { adminUserId?: string } = {}) {
  const apiUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/out-of-office`
    : "/api/settings/out-of-office";
  const [todayKey, setTodayKey] = useState("");
  const [isOutToday, setIsOutToday] = useState(false);
  const [days, setDays] = useState<OooDay[]>([]);
  const [customDate, setCustomDate] = useState("");
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
    setDays(data.days ?? []);
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateOoo(action: "mark" | "clear", dayKey?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, dayKey }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Update failed");
      return;
    }
    const data = await res.json();
    setTodayKey(data.todayKey);
    setIsOutToday(data.isOutToday);
    setDays(data.days ?? []);
    setMessage(action === "mark" ? "Marked out of office." : "Cleared out of office.");
    setCustomDate("");
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
        Mark days when you are away (leave, WFH without laptop, etc.). No reminder alerts will be
        sent for those days. Alert emails and Teams messages include a one-click link to mark
        yourself out for that day.
      </p>

      <div className="rounded-lg border border-[var(--border)] p-4">
        <p className="text-sm font-medium">Today ({todayKey})</p>
        <p className="mt-1 text-sm text-muted">
          {isOutToday
            ? "You are marked out of office today — no alerts for today."
            : "You are not marked out of office today."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isOutToday ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateOoo("mark")}
              className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Mark out today
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateOoo("clear")}
              className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Clear for today
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">Mark another day</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-muted">Date</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="picker-input mt-1 block rounded-lg border px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={busy || !customDate}
            onClick={() => updateOoo("mark", customDate)}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Mark out
          </button>
        </div>
      </div>

      {days.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Upcoming out-of-office days</p>
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
            {days.map((d) => (
              <li key={d.dayKey} className="flex items-center justify-between px-3 py-2">
                <span>
                  {d.dayKey}
                  {d.dayKey === todayKey && (
                    <span className="ml-2 text-xs text-accent">(today)</span>
                  )}
                  <span className="ml-2 text-xs text-muted">via {d.source}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateOoo("clear", d.dayKey)}
                  className="text-xs text-red-400 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
