"use client";

import { useEffect, useState } from "react";
import type {
  AlertDeliveryChannel,
  NotificationPrefsData,
} from "@/lib/notification-prefs";
import { OfficeScheduleSuggestionCard } from "@/components/OfficeScheduleSuggestionCard";

const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const HOURS_ALERT_ROWS: Array<{
  enabledKey: "alertIfHoursStarted" | "alertIfHoursMet";
  channelKey: "channelHoursStarted" | "channelHoursMet";
  label: string;
  help: string;
}> = [
  {
    enabledKey: "alertIfHoursStarted",
    channelKey: "channelHoursStarted",
    label: "Tell me when office hours start counting",
    help: "Sends once per day when office Wi-Fi is first detected, including days that are not usual office days. Default delivery is Microsoft Teams via Power Automate.",
  },
  {
    enabledKey: "alertIfHoursMet",
    channelKey: "channelHoursMet",
    label: "Tell me when I meet my daily hours target",
    help: "Sends once per day when counted office hours reach your daily target. Default delivery is Microsoft Teams via Power Automate.",
  },
];

const ADVANCED_ALERT_ROWS: Array<{
  enabledKey: "alertIfNotInOffice" | "alertIfAgentStale" | "alertIfBehindHours";
  channelKey: "channelNotInOffice" | "channelAgentStale" | "channelBehindHours";
  label: string;
  help: string;
}> = [
  {
    enabledKey: "alertIfNotInOffice",
    channelKey: "channelNotInOffice",
    label: "Remind me if the agent has no Wi-Fi name (after grace period)",
    help: "On a usual office day, after start time plus grace, Office Pulse reminds you if the agent is healthy but cannot report a Wi-Fi name. Working from home on a known non-office network does not trigger this. Default delivery is in the app only.",
  },
  {
    enabledKey: "alertIfAgentStale",
    channelKey: "channelAgentStale",
    label: "Remind me if the agent stops sending heartbeats",
    help: "On a usual office day, after start time plus grace, Office Pulse reminds you if a registered laptop has gone quiet past the stale threshold. Default delivery is in the app only.",
  },
  {
    enabledKey: "alertIfBehindHours",
    channelKey: "channelBehindHours",
    label: "Remind me if I am behind on hours by a set time",
    help: "On a usual office day, after the check time you set below, Office Pulse reminds you if logged office hours are still below the minimum you chose. Off by default. Default delivery is in the app only.",
  },
];

function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-medium leading-none text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
        aria-label={`About ${label}`}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2.5 py-2 text-left text-[11px] leading-snug font-normal text-muted shadow-lg group-hover:block group-focus-within:block sm:left-auto sm:right-0"
      >
        {text}
      </span>
    </span>
  );
}

export function NotificationPrefsForm({ adminUserId }: { adminUserId?: string } = {}) {
  const apiUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/notification-prefs`
    : "/api/settings/notification-prefs";
  const [prefs, setPrefs] = useState<NotificationPrefsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data.prefs);
        setLoading(false);
      });

    function handleScheduleUpdated(event: Event) {
      const schedule = (event as CustomEvent<{
        workDays: number[];
        officeStartTime: string;
        officeEndTime: string | null;
      }>).detail;
      setPrefs((current) =>
        current
          ? {
              ...current,
              workDays: schedule.workDays,
              officeStartTime: schedule.officeStartTime,
              officeEndTime: schedule.officeEndTime ?? current.officeEndTime,
            }
          : current,
      );
    }

    window.addEventListener("office-schedule-updated", handleScheduleUpdated);
    return () => window.removeEventListener("office-schedule-updated", handleScheduleUpdated);
  }, [apiUrl]);

  function toggleWorkDay(day: number) {
    if (!prefs) return;
    const next = prefs.workDays.includes(day)
      ? prefs.workDays.filter((d) => d !== day)
      : [...prefs.workDays, day].sort((a, b) => a - b);
    if (next.length === 0) return;
    setPrefs({ ...prefs, workDays: next });
  }

  async function savePrefs(next: NotificationPrefsData, successMessage: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return false;
    }
    const data = await res.json();
    setPrefs(data.prefs);
    setMessage(successMessage);
    return true;
  }

  async function handleSave() {
    if (!prefs) return;
    const next = { ...prefs, notifyEmail: false };
    await savePrefs(next, "Notification preferences saved.");
  }

  if (loading || !prefs) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Loading notification preferences...</p>
      </section>
    );
  }

  const alertsDisabled = !prefs.notificationsEnabled;

  return (
    <>
      {adminUserId && <OfficeScheduleSuggestionCard adminUserId={adminUserId} />}
      <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">
        {adminUserId ? "Office schedule and alerts (admin)" : "Office schedule and alerts"}
      </h2>
      <p className="mb-4 text-sm text-muted">
        Office hours alerts go to Microsoft Teams by default. Optional reminder alerts stay in the
        app unless you change delivery. Alerts are nudges only, not HR records.
      </p>

      <label className="mb-5 flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={prefs.notificationsEnabled}
          onChange={(e) => setPrefs({ ...prefs, notificationsEnabled: e.target.checked })}
        />
        <span>
          <span className="font-medium">Enable notifications</span>
          <span className="mt-0.5 block text-xs text-muted">
            Turn off to stop all in-app and Teams alerts from Office Pulse.
          </span>
        </span>
      </label>

      <div className={`space-y-5 ${alertsDisabled ? "pointer-events-none opacity-50" : ""}`}>
        <div>
          <p className="mb-2 text-sm font-medium">Usual office days</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleWorkDay(d.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  prefs.workDays.includes(d.value)
                    ? "bg-[var(--pwc-orange)] text-white"
                    : "border border-[var(--border)] text-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted">Usual start time</span>
            <input
              type="time"
              value={prefs.officeStartTime}
              onChange={(e) => setPrefs({ ...prefs, officeStartTime: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted">Usual end time</span>
            <input
              type="time"
              value={prefs.officeEndTime}
              onChange={(e) => setPrefs({ ...prefs, officeEndTime: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-muted">Grace period after start (minutes)</span>
          <input
            type="number"
            min={0}
            max={180}
            value={prefs.graceMinutes}
            onChange={(e) =>
              setPrefs({ ...prefs, graceMinutes: Number.parseInt(e.target.value, 10) || 0 })
            }
            className="mt-1 block w-full max-w-xs rounded-lg border px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">
            Wait this long after your start time before a no Wi-Fi or stale-agent reminder.
          </span>
        </label>

        <p className="text-sm text-muted">
          Reminder alerts can fire on a usual office day after start plus grace when the agent has
          no Wi-Fi name or is not responding, unless the person is out of office. A recent pulse
          from a home or other non-office Wi-Fi is treated as working from home and does not trigger
          a reminder. Usual end time is stored with the schedule; current reminders use start time
          and grace, not end time.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium">Office hours alerts</p>
          <p className="mb-3 text-xs text-muted">
            Default on: Teams when office Wi-Fi is detected and when you meet your daily target.
          </p>
          <div className="space-y-3 text-sm">
            {HOURS_ALERT_ROWS.map((row) => (
              <div
                key={row.enabledKey}
                className="rounded-lg border border-[var(--border)] px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={prefs[row.enabledKey]}
                      onChange={(e) =>
                        setPrefs({ ...prefs, [row.enabledKey]: e.target.checked })
                      }
                    />
                    <span className="font-medium">{row.label}</span>
                  </label>
                  <InfoTip label={row.label} text={row.help} />
                </div>
                <label className="mt-2 flex items-center gap-2 pl-6 text-xs text-muted">
                  Delivery
                  <select
                    value={prefs[row.channelKey]}
                    disabled={!prefs[row.enabledKey]}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        [row.channelKey]: e.target.value as AlertDeliveryChannel,
                      })
                    }
                    className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
                  >
                    <option value="app">In the app</option>
                    <option value="teams">Microsoft Teams</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
          >
            Advanced reminders
            <span className="text-xs text-muted">{advancedOpen ? "Hide" : "Show"}</span>
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-xs text-muted">
                Optional reminders on usual office days only (Wednesday and Friday by default). Off
                by default for this pilot.
              </p>
              {ADVANCED_ALERT_ROWS.map((row) => (
                <div
                  key={row.enabledKey}
                  className="rounded-lg border border-[var(--border)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex min-w-0 items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={prefs[row.enabledKey]}
                        onChange={(e) =>
                          setPrefs({ ...prefs, [row.enabledKey]: e.target.checked })
                        }
                      />
                      <span className="font-medium">{row.label}</span>
                    </label>
                    <InfoTip label={row.label} text={row.help} />
                  </div>
                  <label className="mt-2 flex items-center gap-2 pl-6 text-xs text-muted">
                    Delivery
                    <select
                      value={prefs[row.channelKey]}
                      disabled={!prefs[row.enabledKey]}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          [row.channelKey]: e.target.value as AlertDeliveryChannel,
                        })
                      }
                      className="rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
                    >
                      <option value="app">In the app</option>
                      <option value="teams">Microsoft Teams</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {prefs.alertIfBehindHours && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted">Check time</span>
              <input
                type="time"
                value={prefs.behindHoursCheckTime}
                onChange={(e) =>
                  setPrefs({ ...prefs, behindHoursCheckTime: e.target.value })
                }
                className="mt-1 block w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Minimum hours expected by then</span>
              <input
                type="number"
                min={0}
                max={12}
                step={0.5}
                value={prefs.behindHoursMinExpected}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    behindHoursMinExpected: Number.parseFloat(e.target.value) || 0,
                  })
                }
                className="mt-1 block w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save notification preferences"}
        </button>
        {message && <span className="text-sm text-green-400">{message}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
      </section>
    </>
  );
}
