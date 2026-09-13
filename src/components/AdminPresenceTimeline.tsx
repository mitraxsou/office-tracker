"use client";

import { useCallback, useEffect, useState } from "react";

type TimelineEntry = {
  id: string;
  at: string;
  kind: string;
  label: string;
  ssid: string | null;
  previousSsid: string | null;
  inOffice: boolean | null;
  syncTrigger?: string | null;
  gapMinutes?: number | null;
  lastWifiBeforeGap?: string | null;
};

type TimelineData = {
  entries: TimelineEntry[];
  days: number;
  timezone: string;
  lastWifiAtClose: string | null;
};

const DAY_OPTIONS = [1, 3, 7, 14];

export function AdminPresenceTimeline({
  userId,
  timezone,
  compact = false,
}: {
  userId: string;
  timezone: string;
  compact?: boolean;
}) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActivityTicks, setShowActivityTicks] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/presence-timeline?days=${days}`);
      if (!res.ok) {
        setError("Failed to load Wi-Fi activity");
        return;
      }
      const json: TimelineData = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Failed to load Wi-Fi activity");
    } finally {
      setLoading(false);
    }
  }, [userId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayEntries = (data?.entries ?? []).filter(
    (entry) => showActivityTicks || entry.kind !== "activity_tick",
  );

  const wrapperClass = compact
    ? "mt-3 rounded border border-[var(--border)]/60 p-3"
    : "card p-6";

  return (
    <section className={wrapperClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Wi-Fi and sync activity</h3>
          {!compact && (
            <p className="mt-1 text-xs text-muted">
              Office entry/exit, Wi-Fi changes, laptop wake, and why the agent synced.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
            aria-label="Days to show"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} day{d === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={showActivityTicks}
              onChange={(e) => setShowActivityTicks(e.target.checked)}
              className="rounded"
            />
            Activity ticks
          </label>
        </div>
      </div>

      {data?.lastWifiAtClose && (
        <p className="mb-3 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
          Last Wi-Fi before laptop sleep gap:{" "}
          <span className="font-mono text-[var(--foreground)]">{data.lastWifiAtClose}</span>
        </p>
      )}

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && displayEntries.length === 0 && (
        <p className="text-sm text-muted">No Wi-Fi or sync events in this window.</p>
      )}

      {displayEntries.length > 0 && (
        <div className={compact ? "max-h-64 overflow-y-auto" : "max-h-96 overflow-y-auto"}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-muted">
                <th className="py-1 pr-2">Time</th>
                <th className="py-1 pr-2">Event</th>
                <th className="py-1 pr-2">SSID</th>
                <th className="py-1">In office</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {new Date(entry.at).toLocaleString("en-IN", { timeZone: timezone })}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span>{entry.label}</span>
                    {entry.gapMinutes != null && entry.gapMinutes >= 15 && (
                      <span className="mt-0.5 block text-[10px] text-muted">
                        Gap: {entry.gapMinutes}m
                        {entry.lastWifiBeforeGap
                          ? ` · last Wi-Fi: ${entry.lastWifiBeforeGap}`
                          : ""}
                      </span>
                    )}
                    {entry.previousSsid && entry.kind === "ssid_changed" && (
                      <span className="mt-0.5 block font-mono text-[10px] text-muted">
                        {entry.previousSsid} → {entry.ssid ?? "(none)"}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 font-mono">{entry.ssid ?? "-"}</td>
                  <td className="py-1.5">
                    {entry.inOffice === null ? "-" : entry.inOffice ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
