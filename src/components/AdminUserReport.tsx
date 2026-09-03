"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminVisitManager } from "./AdminVisitManager";
import { NotificationPrefsForm } from "./NotificationPrefsForm";
import { OutOfOfficeSection } from "./OutOfOfficeSection";
import { VisitCalendar } from "./reports/VisitCalendar";
import { HoursTrendChart } from "./reports/ReportCharts";
import { exportDailyTrendCsv, MonthReportToolbar } from "./reports/ReportToolbar";
import { currentMonthKey } from "@/lib/month-range";
import { dayKeyInTimezone, formatHours, formatTime } from "@/lib/visits";
import {
  describeResetRange,
  resetRangeFromPeriod,
  RESET_PERIOD_LABELS,
  type ResetPeriod,
} from "@/lib/data-reset";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { AdminUserProfileChangeForm } from "./AdminUserProfileChangeForm";
import { AdminGrantComplianceExemption } from "./AdminGrantComplianceExemption";
import type { ProfileChangeRequestSummary } from "@/lib/profile-change-requests";
import { AdminUserReportSearch } from "./AdminUserReportSearch";
import {
  describeDeviceAgentVersion,
  summarizeDeviceAgentVersions,
} from "@/lib/agent-version-display";
import { formatPulseAge } from "@/lib/pulse-age";

type UserReport = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    timezone: string;
    hoursTarget: number;
  };
  today: {
    totalHours: number;
    laptopActiveHours: number;
    metTarget: boolean;
    agentHealthy: boolean;
    inOfficeNow: boolean;
    lastHeartbeat: string | null;
  };
  dailyTrend: Array<{
    date: string;
    totalHours: number;
    laptopActiveHours: number;
    metTarget: boolean;
  }>;
  visits: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    source: string;
    ssid: string | null;
  }>;
  heartbeats: Array<{
    id: string;
    recordedAt: string;
    inOffice: boolean;
    ssid: string | null;
  }>;
  pulse: {
    pulsesLast24h: number;
    expectedPulsesPerDay: number;
    minutesSinceLastPulse: number | null;
    agentHealthy: boolean;
    lastHeartbeat: string | null;
    recentPulses: Array<{ recordedAt: string; inOffice: boolean; ssid: string | null }>;
  };
  serverAgentVersion: string;
  devices: Array<{
    id: string;
    serialNumber: string;
    lastSeenAt: string | null;
    installedAt?: string | null;
    uninstalledAt?: string | null;
    agentScriptVersion: string | null;
    agentVersionReportedAt: string | null;
    agentVersionStale: boolean;
  }>;
  lifecycleEvents?: Array<{
    id: string;
    deviceId: string | null;
    serialNumber: string;
    eventType: string;
    source: string;
    createdAt: string;
  }>;
  tokens: Array<{
    id: string;
    prefix: string;
    label: string | null;
    status: string;
    boundSerialNumber: string | null;
    expiresAt: string | null;
  }>;
  range: { days: number; from: string; to: string; month: string; currentMonth: string };
  monthlyDaysTarget: number;
  monthlyProgress: {
    monthKey: string;
    qualifyingDays: number;
    monthlyDaysTarget: number;
    metTarget: boolean;
  };
};

export function AdminUserReport({
  userId,
  profileChangeBlocked,
  profileChangeBlockedMessage,
  profileChangeOpenRequest,
}: {
  userId: string;
  profileChangeBlocked?: boolean;
  profileChangeBlockedMessage?: string | null;
  profileChangeOpenRequest?: ProfileChangeRequestSummary | null;
}) {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(() => currentMonthKey("Asia/Kolkata"));
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [data, setData] = useState<UserReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [officeSsids, setOfficeSsids] = useState<string[]>([]);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetScope, setResetScope] = useState<"tracking" | "all">("tracking");
  const [resetPeriod, setResetPeriod] = useState<ResetPeriod>("all");
  const [resetDay, setResetDay] = useState("");
  const [resetMonth, setResetMonth] = useState("");
  const [resetYear, setResetYear] = useState("");
  const [resetFrom, setResetFrom] = useState("");
  const [resetTo, setResetTo] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);

  const load = useCallback(async (month: string) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    const res = await fetch(`/api/admin/users/${userId}/reports?${qs}`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load user report");
      return;
    }
    const json = await res.json();
    setData(json);
    setMonthKey(json.range.month);
    setFromKey(json.range.from);
    setToKey(json.range.to);
    setSelectedDate(null);
    setError(null);
  }, [userId]);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => setOfficeSsids(data.config?.officeSsids ?? []))
      .catch(() => setOfficeSsids([]));
  }, []);

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filteredVisits = useMemo(() => {
    if (!data) return [];
    if (!selectedDate) return data.visits;
    return data.visits.filter(
      (v) => dayKeyInTimezone(new Date(v.startAt), data.user.timezone) === selectedDate,
    );
  }, [data, selectedDate]);

  const resetRange = useMemo(
    () =>
      resetRangeFromPeriod(resetPeriod, {
        day: resetDay,
        month: resetMonth,
        year: resetYear,
        from: resetFrom,
        to: resetTo,
      }),
    [resetPeriod, resetDay, resetMonth, resetYear, resetFrom, resetTo],
  );

  async function handleReset() {
    if (resetConfirm !== "RESET") {
      setActionError('Type RESET to confirm');
      return;
    }
    if (resetPeriod !== "all" && !resetRange) {
      setActionError("Pick a valid date range to clear");
      return;
    }
    if (!confirm(`Clear ${describeResetRange(resetRange)} for ${data?.user.email}?`)) return;

    setActionError(null);
    setResetMessage(null);
    const res = await fetch(`/api/admin/users/${userId}/reset-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: resetScope,
        confirm: "RESET",
        fromDayKey: resetRange?.fromDayKey,
        toDayKey: resetRange?.toDayKey,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(body.error ?? "Reset failed");
      return;
    }
    setResetConfirm("");
    setResetMessage(
      `Cleared ${body.visitsDeleted ?? 0} visits and ${body.heartbeatsDeleted ?? 0} pulses for ${describeResetRange(resetRange)}.`,
    );
    load(monthKey);
  }

  async function handleDeleteUser() {
    if (!confirm(`Delete user ${data?.user.email} and all their data permanently?`)) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Delete failed");
      return;
    }
    router.push("/admin");
  }

  async function handleViewAsUser() {
    setImpersonating(true);
    setActionError(null);
    const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setImpersonating(false);
    if (!res.ok) {
      setActionError(body.error ?? "Failed to start view-as mode");
      return;
    }
    router.push(body.redirectTo ?? "/dashboard");
    router.refresh();
  }

  if (loading && !data) return <p className="text-muted">Loading user report...</p>;
  if (error && !data) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  const agentHealthLabel = data.pulse.agentHealthy
    ? "Healthy"
    : data.pulse.lastHeartbeat
      ? "Stale"
      : "No pulses";
  const installedVersionSummary = summarizeDeviceAgentVersions(data.devices);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-56">
          <Link href="/admin" className="text-sm text-accent hover:underline">
            ← Back to reports
          </Link>
          <h2 className="mt-1 text-xl font-medium">{data.user.email}</h2>
          {data.user.name && <p className="text-sm text-muted">{data.user.name}</p>}
        </div>
        <AdminUserReportSearch currentUserId={data.user.id} />
        <button
          type="button"
          onClick={() => void handleViewAsUser()}
          disabled={impersonating}
          className="btn-secondary px-3 py-1.5 text-sm"
        >
          {impersonating ? "Starting..." : "View as user"}
        </button>
      </div>

      <MonthReportToolbar
        monthKey={monthKey}
        timezone={data.user.timezone}
        onMonthChange={(m) => load(m)}
        onExport={() =>
          exportDailyTrendCsv(
            `user-${data.user.email}-${monthKey}.csv`,
            data.dailyTrend.map((d) => ({
              date: d.date,
              totalHours: d.totalHours,
              metTarget: d.metTarget,
            })),
          )
        }
      >
        <button type="button" onClick={() => load(monthKey)} className="btn-secondary px-3 py-1 text-xs">
          Refresh
        </button>
      </MonthReportToolbar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <SummaryCard label="Today (office)" value={`${data.today.totalHours.toFixed(1)}h / ${data.user.hoursTarget}h`} />
        <SummaryCard
          label="Laptop active"
          value={`${data.today.laptopActiveHours.toFixed(1)}h`}
        />
        <SummaryCard label="5h met" value={data.today.metTarget ? "Yes" : "No"} />
        <SummaryCard
          label="Office days"
          value={`${data.monthlyProgress.qualifyingDays} / ${data.monthlyDaysTarget}`}
        />
        <SummaryCard
          label={`Agent (expected ${data.serverAgentVersion})`}
          value={`${agentHealthLabel} · ${installedVersionSummary}`}
        />
        <SummaryCard label="Pulses (24h)" value={`${data.pulse.pulsesLast24h} / ~${data.pulse.expectedPulsesPerDay}`} />
      </div>

      <section className="card p-6">
        <h3 className="mb-4 text-sm font-medium">Office visit calendar</h3>
        <VisitCalendar
          monthKey={monthKey}
          timezone={data.user.timezone}
          hoursTarget={data.user.hoursTarget}
          dailyTrend={data.dailyTrend}
          visits={data.visits}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </section>

      <section className="card p-6">
        <HoursTrendChart
          data={data.dailyTrend.map((d) => ({
            date: d.date,
            totalHours: d.totalHours,
            metTarget: d.metTarget,
          }))}
          targetHours={data.user.hoursTarget}
          title={`Daily hours (${monthKey})`}
          selectedDate={selectedDate}
          onBarClick={(date) => setSelectedDate((prev) => (prev === date ? null : date))}
        />
      </section>

      <section className="card p-6">
        <h3 className="mb-3 text-sm font-medium">
          {selectedDate ? `Visits on ${selectedDate}` : "Visits this month"}
        </h3>
        {filteredVisits.length === 0 ? (
          <p className="text-sm text-muted">No visits in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-muted">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Start</th>
                  <th className="py-2 pr-4">End</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2">SSID</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map((v) => {
                  const start = new Date(v.startAt);
                  const end = v.endAt ? new Date(v.endAt) : null;
                  const durationMs = end ? end.getTime() - start.getTime() : 0;
                  return (
                    <tr key={v.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-4">
                        {dayKeyInTimezone(start, data.user.timezone)}
                      </td>
                      <td className="py-2 pr-4">{formatTime(start, data.user.timezone)}</td>
                      <td className="py-2 pr-4">
                        {end ? formatTime(end, data.user.timezone) : "open"}
                      </td>
                      <td className="py-2 pr-4">
                        {end ? formatHours(durationMs / (1000 * 60 * 60)) : "-"}
                      </td>
                      <td className="py-2 pr-4">{v.source}</td>
                      <td className="py-2">{v.ssid ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Agent pulse</h3>
          <span className="text-xs text-muted">
            Expected agent version: {data.serverAgentVersion}
          </span>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Last heartbeat</dt>
            <dd>
              {data.pulse.lastHeartbeat
                ? new Date(data.pulse.lastHeartbeat).toLocaleString("en-IN")
                : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Time since last pulse</dt>
            <dd>
              {formatPulseAge({
                minutes: data.pulse.minutesSinceLastPulse,
                lastPulseAt: data.pulse.lastHeartbeat,
                timezone: data.user.timezone,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Laptop active today</dt>
            <dd>{data.today.laptopActiveHours.toFixed(1)}h</dd>
          </div>
          <div>
            <dt className="text-muted">In office now</dt>
            <dd>{data.today.inOfficeNow ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted">Registered laptops</dt>
            <dd>{data.devices.length}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Installed agent versions</dt>
            <dd>
              {data.devices.length === 0 ? (
                "No registered laptops"
              ) : (
                <ul className="mt-1 space-y-1">
                  {data.devices.map((device) => {
                    const version = describeDeviceAgentVersion(
                      device.agentScriptVersion,
                      device.agentVersionStale,
                    );
                    return (
                      <li key={device.id}>
                        <code>{device.serialNumber}</code>: {version.version}
                        <span
                          className={
                            version.state === "current" ? "text-green-400" : "text-accent"
                          }
                        >
                          {" "}
                          ({version.note})
                        </span>
                        {" · "}
                        last seen{" "}
                        {device.lastSeenAt
                          ? new Date(device.lastSeenAt).toLocaleString("en-IN", {
                              timeZone: data.user.timezone,
                            })
                          : "never"}
                      </li>
                    );
                  })}
                </ul>
              )}
            </dd>
          </div>
        </dl>
        {data.pulse.recentPulses.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {data.pulse.recentPulses.map((p, i) => (
              <li key={i}>
                {new Date(p.recordedAt).toLocaleString("en-IN")} ·{" "}
                {p.inOffice ? "in office" : "out"} · {p.ssid ?? "no SSID"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h3 className="mb-3 text-sm font-medium">Recent heartbeats (retention window)</h3>
        {data.heartbeats.length === 0 ? (
          <p className="text-sm text-muted">No heartbeats in range.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-muted">
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">In office</th>
                  <th className="py-1">SSID</th>
                </tr>
              </thead>
              <tbody>
                {data.heartbeats.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--border)]">
                    <td className="py-1 pr-2">{new Date(h.recordedAt).toLocaleString("en-IN")}</td>
                    <td className="py-1 pr-2">{h.inOffice ? "Yes" : "No"}</td>
                    <td className="py-1 font-mono">{h.ssid ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.lifecycleEvents && data.lifecycleEvents.length > 0 && (
        <section className="card p-6">
          <h3 className="mb-3 text-sm font-medium">Agent install / uninstall history</h3>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-muted">
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">Event</th>
                  <th className="py-1 pr-2">Serial</th>
                  <th className="py-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.lifecycleEvents.map((event) => (
                  <tr key={event.id} className="border-b border-[var(--border)]">
                    <td className="py-1 pr-2">
                      {new Date(event.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-1 pr-2">{event.eventType}</td>
                    <td className="py-1 pr-2 font-mono">{event.serialNumber}</td>
                    <td className="py-1">{event.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card p-6">
        <h3 className="mb-2 text-sm font-medium">Account</h3>
        <p className="mb-3 text-sm text-muted">
          Issue a temporary password if the user cannot sign in. Share it once; it is not stored in
          plain text.
        </p>
        <AdminResetPasswordButton userId={userId} userEmail={data.user.email} />
        <AdminUserProfileChangeForm
          userId={userId}
          currentName={data.user.name}
          currentEmail={data.user.email}
          openRequest={profileChangeOpenRequest}
          blocked={profileChangeBlocked}
          blockedMessage={profileChangeBlockedMessage}
        />
      </section>

      <AdminGrantComplianceExemption userId={userId} />

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Notifications and out of office</h3>
          <p className="mt-1 text-sm text-muted">
            Manage alert settings when the user cannot access the portal. Out-of-office days and
            non-work days (e.g. Sat/Sun) suppress all reminders.
          </p>
        </div>
        <OutOfOfficeSection adminUserId={userId} />
        <NotificationPrefsForm adminUserId={userId} />
      </div>

      <AdminVisitManager
        userId={userId}
        officeSsids={officeSsids}
        timezone={data.user.timezone}
        onChanged={() => load(monthKey)}
      />

      <section className="card border-red-500/30 p-6">
        <h3 className="mb-2 text-lg font-medium text-red-400">Clear tracking data</h3>
        <p className="mb-4 text-sm text-muted">
          Clear visits and pulses for a day, a month, a year, or a custom range when the data is
          wrong. Deleting the user account removes everything permanently.
        </p>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">What to clear</span>
            <select
              value={resetPeriod}
              onChange={(e) => setResetPeriod(e.target.value as ResetPeriod)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {(Object.keys(RESET_PERIOD_LABELS) as ResetPeriod[]).map((period) => (
                <option key={period} value={period}>
                  {RESET_PERIOD_LABELS[period]}
                </option>
              ))}
            </select>
          </label>

          {resetPeriod === "day" && (
            <label className="text-sm">
              <span className="mb-1 block text-muted">Day</span>
              <input
                type="date"
                value={resetDay}
                onChange={(e) => setResetDay(e.target.value)}
                className="picker-input w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          )}

          {resetPeriod === "month" && (
            <label className="text-sm">
              <span className="mb-1 block text-muted">Month</span>
              <input
                type="month"
                value={resetMonth}
                onChange={(e) => setResetMonth(e.target.value)}
                className="picker-input w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          )}

          {resetPeriod === "year" && (
            <label className="text-sm">
              <span className="mb-1 block text-muted">Year</span>
              <input
                type="number"
                min={2000}
                max={2100}
                placeholder="2026"
                value={resetYear}
                onChange={(e) => setResetYear(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          )}

          {resetPeriod === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-muted">From</span>
                <input
                  type="date"
                  value={resetFrom}
                  onChange={(e) => setResetFrom(e.target.value)}
                  className="picker-input w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">To</span>
                <input
                  type="date"
                  value={resetTo}
                  onChange={(e) => setResetTo(e.target.value)}
                  className="picker-input w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}
        </div>

        {resetPeriod === "all" && (
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={resetScope === "tracking"}
                onChange={() => setResetScope("tracking")}
              />
              Tracking only (visits + pulses)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={resetScope === "all"}
                onChange={() => setResetScope("all")}
              />
              All agent data (+ tokens + devices)
            </label>
          </div>
        )}

        <p className="mb-3 text-sm text-muted">
          Will clear: <span className="text-foreground">{describeResetRange(resetRange)}</span>
          {resetPeriod !== "all" && " (visits and pulses only, tokens and devices are kept)"}
        </p>

        <input
          type="text"
          placeholder="Type RESET to confirm"
          value={resetConfirm}
          onChange={(e) => setResetConfirm(e.target.value)}
          className="mb-3 w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleReset} className="btn-secondary px-4 py-2 text-sm">
            Clear data
          </button>
          <button
            type="button"
            onClick={handleDeleteUser}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete user account
          </button>
        </div>
        {resetMessage && <p className="mt-3 text-sm text-green-400">{resetMessage}</p>}
        {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
