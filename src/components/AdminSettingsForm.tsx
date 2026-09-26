"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  fiscalYearEndMonthForStart,
  formatFiscalYearSpanLabel,
  MONTH_NAMES,
} from "@/lib/fiscal-year";

export function AdminSettingsForm({
  hoursTarget,
  monthlyDaysTarget,
  officeSsids,
  maxDevicesPerUser,
  pendingTokenTtlDays,
  heartbeatRetentionDays,
  heartbeatIntervalMinutes,
  agentStaleMinutes,
  agentStaleGraceHours,
  agentMode,
  fiscalYearStartMonth,
  fiscalYearEndMonth,
}: {
  hoursTarget: number;
  monthlyDaysTarget: number;
  officeSsids: string[];
  maxDevicesPerUser: number;
  pendingTokenTtlDays: number;
  heartbeatRetentionDays: number;
  heartbeatIntervalMinutes: number;
  agentStaleMinutes: number;
  agentStaleGraceHours: number;
  agentMode: string;
  fiscalYearStartMonth: number;
  fiscalYearEndMonth: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(hoursTarget);
  const [daysTarget, setDaysTarget] = useState(monthlyDaysTarget);
  const [ssidText, setSsidText] = useState(officeSsids.join("\n"));
  const [maxDevices, setMaxDevices] = useState(maxDevicesPerUser);
  const [tokenTtl, setTokenTtl] = useState(pendingTokenTtlDays);
  const [heartbeatRetention, setHeartbeatRetention] = useState(heartbeatRetentionDays);
  const [heartbeatInterval, setHeartbeatInterval] = useState(heartbeatIntervalMinutes);
  const [staleMinutes, setStaleMinutes] = useState(agentStaleMinutes);
  const [graceHours, setGraceHours] = useState(agentStaleGraceHours);
  const [mode, setMode] = useState(agentMode === "heartbeat" ? "heartbeat" : "events");
  const [fyStartMonth, setFyStartMonth] = useState(fiscalYearStartMonth);
  const [fyEndMonth, setFyEndMonth] = useState(fiscalYearEndMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleFyStartChange(month: number) {
    setFyStartMonth(month);
    setFyEndMonth(fiscalYearEndMonthForStart(month));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const ssidList = ssidText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hoursTarget: target,
        monthlyDaysTarget: daysTarget,
        officeSsids: ssidList,
        maxDevicesPerUser: maxDevices,
        pendingTokenTtlDays: tokenTtl,
        heartbeatRetentionDays: heartbeatRetention,
        heartbeatIntervalMinutes: heartbeatInterval,
        agentStaleMinutes: staleMinutes,
        agentStaleGraceHours: graceHours,
        agentMode: mode,
        fiscalYearStartMonth: fyStartMonth,
        fiscalYearEndMonth: fyEndMonth,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Global office targets</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Daily hours target</span>
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Monthly office days target</span>
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              value={daysTarget}
              onChange={(e) => setDaysTarget(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Fiscal year</h2>
        <p className="mb-4 text-sm text-muted">
          Defines which months count as a fiscal year for year compliance and FY exports. The year
          always spans exactly 12 months.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Start month</span>
            <select
              value={fyStartMonth}
              onChange={(e) => handleFyStartChange(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">End month</span>
            <select
              value={fyEndMonth}
              disabled
              className="mt-1 w-full max-w-xs rounded-lg border bg-muted/20 px-3 py-2"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Current span: {formatFiscalYearSpanLabel({ startMonth: fyStartMonth, endMonth: fyEndMonth })}
        </p>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Office Wi-Fi SSIDs (global)</h2>
        <p className="mb-3 text-sm text-muted">
          One SSID per line (or comma-separated). Matching is case-insensitive. Windows may append
          band numbers or <code className="text-xs">(Unauthenticated)</code> to captive portal names;
          the server strips those automatically. Prefix matching is supported:{" "}
          <code className="text-xs">pwcglb.com</code> matches{" "}
          <code className="text-xs">pwcglb.com 2 (Unauthenticated)</code>. Optional trailing{" "}
          <code className="text-xs">*</code> is allowed (e.g. <code className="text-xs">pwcglb.com*</code>
          ).
        </p>
        <p className="mb-3 text-xs text-muted">
          Recommended defaults: <code>OfficeConnect</code>, <code>ExternalConnect</code>,{" "}
          <code>pwcglb.com</code>. Set <code>DEFAULT_OFFICE_SSIDS</code> in Vercel env to seed new
          installs; admin edits here apply immediately and backfill recent agent activity.
        </p>
        <textarea
          value={ssidText}
          onChange={(e) => setSsidText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Max laptops per user</h2>
        <input
          type="number"
          min={1}
          max={50}
          value={maxDevices}
          onChange={(e) => setMaxDevices(Number(e.target.value))}
          className="w-full max-w-xs rounded-lg border px-3 py-2"
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Agent sync settings</h2>
        <p className="mb-4 text-sm text-muted">
          Agents wake every 2 minutes and sync with the server on the check-in interval. Each sync
          sends Wi-Fi events, activity ticks, and visit updates. Pending install tokens auto-revoke
          if never bound.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-muted">Pending token TTL (days)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={tokenTtl}
              onChange={(e) => setTokenTtl(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Agent check-in interval (minutes)</span>
            <input
              type="number"
              min={2}
              max={60}
              value={heartbeatInterval}
              onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Visit gap (minutes)</span>
            <input
              type="number"
              min={2}
              max={60}
              value={staleMinutes}
              onChange={(e) => setStaleMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Agent health grace (hours)</span>
            <input
              type="number"
              min={1}
              max={168}
              value={graceHours}
              onChange={(e) => setGraceHours(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Keep visit gap at about 3 times the check-in interval. Health grace (default 24h) flags
          stale agents when no sync or activity for that long and the user is not out of office.
        </p>

        <details className="mt-4 rounded-lg border border-[var(--border)] p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Advanced agent options</summary>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-muted">Agent mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
              >
                <option value="events">Events (recommended)</option>
                <option value="heartbeat">Legacy heartbeat only</option>
              </select>
              <span className="mt-1 block text-xs text-muted">
                Events mode uses POST /api/agent/sync. Legacy heartbeat is a fallback for older
                agents only.
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-muted">Diagnostic retention (days)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={heartbeatRetention}
                onChange={(e) => setHeartbeatRetention(Number(e.target.value))}
                className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
              />
              <span className="mt-1 block text-xs text-muted">
                How long raw diagnostic rows (legacy heartbeats and activity ticks) are kept.
                Visits, daily summaries, and API-hit day totals are kept. Purge runs via
                maintenance cron. Default 7 days.
              </span>
            </label>
          </div>
        </details>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Global config saved.</p>}

      <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
        {loading ? "Saving..." : "Save global config"}
      </button>
    </form>
  );
}
