"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MetricHelp } from "@/components/MetricHelp";
import { RecentHeartbeats } from "@/components/RecentHeartbeats";
import { ADMIN_SETTINGS_HREF } from "@/lib/admin-settings-hash";

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

type LastUploadedTick = {
  recordedAt: string;
  inOffice: boolean;
  ssid: string | null;
};

const DAY_OPTIONS = [1, 3, 7, 14];

export function AdminPresenceTimeline({
  userId,
  timezone,
  compact = false,
  selectedDate = null,
  lastUploadedTicks = [],
  retentionDays = 7,
}: {
  userId: string;
  timezone: string;
  compact?: boolean;
  selectedDate?: string | null;
  lastUploadedTicks?: LastUploadedTick[];
  retentionDays?: number;
}) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActivityTicks, setShowActivityTicks] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (selectedDate) {
        qs.set("date", selectedDate);
      } else {
        qs.set("days", String(days));
      }
      const res = await fetch(`/api/admin/users/${userId}/presence-timeline?${qs}`);
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
  }, [userId, days, selectedDate]);

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
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium">Wi-Fi and sync activity</h3>
            <MetricHelp
              label="Wi-Fi and sync activity help"
              tooltip="Selected day's visit enter/exit, SSID changes, sleep/wake, and sync/health rows. Use this first when hours or Wi-Fi look wrong. Not the live office clock."
            />
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-muted">
              {selectedDate
                ? `Office entry/exit, Wi-Fi changes, and sync events for ${selectedDate}.`
                : "Office entry/exit, Wi-Fi changes, laptop wake, and why the agent synced."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!selectedDate && (
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
          )}
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={showActivityTicks}
              onChange={(e) => setShowActivityTicks(e.target.checked)}
              className="rounded"
            />
            Activity ticks
            <MetricHelp
              label="Activity ticks help"
              tooltip={`Dense 2-minute SSID trail for the selected day, only after those ticks uploaded (usually after midnight). Off by default so hundreds of rows do not bury enter/exit. Server keeps about ${retentionDays} day${retentionDays === 1 ? "" : "s"}. Local 2-minute interval is hardcoded on the agent.`}
            />
          </label>
        </div>
      </div>

      {data?.lastWifiAtClose && (
        <p className="mb-3 flex flex-wrap items-center gap-1 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
          <span>
            Last Wi-Fi before laptop sleep gap:{" "}
            <span className="font-mono text-[var(--foreground)]">{data.lastWifiAtClose}</span>
          </span>
          <MetricHelp
            label="Last Wi-Fi before sleep help"
            tooltip="SSID from the last long sleep/wake gap, not current Wi-Fi. Visit gap in Global settings controls when sleep ends an office visit."
          />
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

      {!compact && (
        <div className="mt-3 space-y-2 text-xs text-muted">
          <p>
            When to use: Visits and this table for office hours. Activity ticks after end of day
            for a dense SSID trail. Last uploaded ticks only to see what last landed. Laptop
            heartbeat.log for sync or update failures (size-capped on the machine, not a day
            count).
          </p>
          <p>
            Keep ticks for {retentionDays} day{retentionDays === 1 ? "" : "s"}:{" "}
            <Link href={ADMIN_SETTINGS_HREF.diagnosticRetention} className="text-accent hover:underline">
              Global settings, Diagnostic retention
            </Link>
            . Hourly last-seen:{" "}
            <Link href={ADMIN_SETTINGS_HREF.agentSync} className="text-accent hover:underline">
              Agent health grace
            </Link>
            . Sleep ending a visit:{" "}
            <Link href={ADMIN_SETTINGS_HREF.agentSync} className="text-accent hover:underline">
              Visit gap
            </Link>
            . Purge:{" "}
            <Link href={ADMIN_SETTINGS_HREF.cronJobs} className="text-accent hover:underline">
              purge-heartbeats
            </Link>
            {" · "}
            <Link href={ADMIN_SETTINGS_HREF.dataMaintenance} className="text-accent hover:underline">
              Data maintenance
            </Link>
            . Check-in interval is not when ticks upload.
          </p>
        </div>
      )}

      {!compact && lastUploadedTicks.length > 0 && (
        <details className="mt-4 rounded border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Debug: last uploaded ticks
            <span className="ml-1.5 inline-flex align-middle">
              <MetricHelp
                label="Last uploaded ticks help"
                tooltip="Last 12 ticks that reached the server, newest first. Often last night until end-of-day flush. Not the selected day and not live status. Display limit of 12, not retention."
              />
            </span>
          </summary>
          <div className="mt-3">
            <RecentHeartbeats
              pulses={lastUploadedTicks}
              timezone={timezone}
              embedded
              lastUploadedOnly
            />
          </div>
        </details>
      )}
    </section>
  );
}
