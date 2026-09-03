"use client";

import { useEffect, useState } from "react";
import type { NotificationPrefsData } from "@/lib/notification-prefs";

const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

type ScheduleSuggestion = {
  workDays: number[];
  officeStartTime: string;
  officeEndTime: string | null;
};

function formatWorkDays(days: number[]): string {
  const labels = days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
    .filter((label): label is string => Boolean(label));
  return labels.join(", ");
}

export function NotificationPrefsForm({ adminUserId }: { adminUserId?: string } = {}) {
  const apiUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/notification-prefs`
    : "/api/settings/notification-prefs";
  const [prefs, setPrefs] = useState<NotificationPrefsData | null>(null);
  const [suggestion, setSuggestion] = useState<ScheduleSuggestion | null>(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data.prefs);
        setSuggestion(data.suggestion ?? null);
        setDismissedSuggestion(false);
        setLoading(false);
      });
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
    await savePrefs(prefs, "Notification preferences saved.");
  }

  async function handleUseSuggestion() {
    if (!prefs || !suggestion) return;
    const next: NotificationPrefsData = {
      ...prefs,
      workDays: suggestion.workDays,
      officeStartTime: suggestion.officeStartTime,
      officeEndTime: suggestion.officeEndTime ?? prefs.officeEndTime,
    };
    const ok = await savePrefs(next, "Saved suggested usual days and times.");
    if (ok) {
      setSuggestion(null);
      setDismissedSuggestion(true);
    }
  }

  if (loading || !prefs) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Loading notification preferences...</p>
      </section>
    );
  }

  const alertsDisabled = !prefs.notificationsEnabled;
  const showSuggestion = Boolean(suggestion) && !dismissedSuggestion;

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">
        {adminUserId ? "Office schedule and alerts (admin)" : "Office schedule and alerts"}
      </h2>
      <p className="mb-4 text-sm text-muted">
        Used by Power Automate to send Teams and email reminders. Alerts are nudges only, not HR
        records. Reminders are sent only on {adminUserId ? "the user's" : "your"} selected{" "}
        <strong>usual office days</strong> (e.g. Mon-Fri by default; Sat/Sun are skipped unless
        enabled). Fill usual days and times from office visit history when there is enough data.
        Edit anytime to keep your own.
      </p>

      {showSuggestion && suggestion && (
        <div className="mb-5 rounded-lg border border-[var(--border)] px-4 py-3">
          <p className="text-sm font-medium">Suggested from office visits (last 8 weeks)</p>
          <p className="mt-1 text-sm text-muted">
            Days: {formatWorkDays(suggestion.workDays)}. Start: {suggestion.officeStartTime}
            {suggestion.officeEndTime ? `. End: ${suggestion.officeEndTime}` : ". End: not enough check-outs to suggest."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleUseSuggestion()}
              disabled={saving}
              className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Use suggested times
            </button>
            <button
              type="button"
              onClick={() => setDismissedSuggestion(true)}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
            >
              Keep current
            </button>
          </div>
        </div>
      )}

      <label className="mb-5 flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={prefs.notificationsEnabled}
          onChange={(e) => setPrefs({ ...prefs, notificationsEnabled: e.target.checked })}
        />
        <span>
          <span className="font-medium">Enable notifications</span>
          <span className="mt-0.5 block text-xs text-muted">
            Turn off to stop all Teams and email alerts from Office Pulse.
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
            Wait this long after your start time before a &quot;not in office&quot; alert.
          </span>
        </label>

        <p className="text-sm text-muted">
          These times drive &quot;not in office&quot; alerts only when notifications are on and that
          alert type is enabled (Teams and/or email as configured). The alert can fire on a usual
          office day after usual start plus grace, if there is no in-office pulse yet and the person
          is not out of office. Usual days choose which weekdays those work-day alerts can fire.
          Usual end time is stored with the schedule; current alerts use start time and grace, not
          end time.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium">Delivery channels</p>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.notifyTeams}
                onChange={(e) => setPrefs({ ...prefs, notifyTeams: e.target.checked })}
              />
              Microsoft Teams (via Power Automate)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.notifyEmail}
                onChange={(e) => setPrefs({ ...prefs, notifyEmail: e.target.checked })}
              />
              Email (via Power Automate / Outlook)
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Alert types</p>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.alertIfNotInOffice}
                onChange={(e) => setPrefs({ ...prefs, alertIfNotInOffice: e.target.checked })}
              />
              Remind me if no office Wi-Fi on a work day (after grace period)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.alertIfAgentStale}
                onChange={(e) => setPrefs({ ...prefs, alertIfAgentStale: e.target.checked })}
              />
              Remind me if the agent stops sending heartbeats
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.alertIfBehindHours}
                onChange={(e) => setPrefs({ ...prefs, alertIfBehindHours: e.target.checked })}
              />
              Remind me if I am behind on hours by a set time
            </label>
          </div>
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
  );
}
