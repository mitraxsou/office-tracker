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

export function NotificationPrefsForm() {
  const [prefs, setPrefs] = useState<NotificationPrefsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/notification-prefs")
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data.prefs);
        setLoading(false);
      });
  }, []);

  function toggleWorkDay(day: number) {
    if (!prefs) return;
    const next = prefs.workDays.includes(day)
      ? prefs.workDays.filter((d) => d !== day)
      : [...prefs.workDays, day].sort((a, b) => a - b);
    if (next.length === 0) return;
    setPrefs({ ...prefs, workDays: next });
  }

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/notification-prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return;
    }
    const data = await res.json();
    setPrefs(data.prefs);
    setMessage("Notification preferences saved.");
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
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">Office schedule and alerts</h2>
      <p className="mb-4 text-sm text-muted">
        Used by Power Automate to send Teams and email reminders. Alerts are nudges only, not HR
        records.
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
