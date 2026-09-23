"use client";

import { useEffect, useState } from "react";
import type {
  AlertDeliveryChannel,
  NotificationPrefsData,
} from "@/lib/notification-prefs";
import {
  deliveryFlagsFromChannel,
  toggleDeliveryChannel,
} from "@/lib/notification-prefs";

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
    help: "Sends once per day when office Wi-Fi is first detected, followed by a monthly snapshot with completed days, today's projected total, and days remaining. Default delivery is Microsoft Teams via Power Automate.",
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
    help: "On a usual office day, after start time plus grace, My Office Pulse reminds you if the agent is healthy but cannot report a Wi-Fi name. Working from home on a known non-office network does not trigger this. Default delivery is in the app only.",
  },
  {
    enabledKey: "alertIfAgentStale",
    channelKey: "channelAgentStale",
    label: "Remind me if the agent stops syncing",
    help: "On a usual office day, after start time plus grace, My Office Pulse reminds you if a registered laptop has gone quiet past the stale threshold. Default delivery is in the app only.",
  },
  {
    enabledKey: "alertIfBehindHours",
    channelKey: "channelBehindHours",
    label: "Remind me if I am behind on hours by a set time",
    help: "On a usual office day, after the check time you set below, My Office Pulse reminds you if logged office hours are still below the minimum you chose. Off by default. Default delivery is in the app only.",
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

function DeliveryChannelCheckboxes({
  channel,
  disabled,
  onChange,
}: {
  channel: AlertDeliveryChannel;
  disabled: boolean;
  onChange: (next: AlertDeliveryChannel) => void;
}) {
  const { app, teams } = deliveryFlagsFromChannel(channel);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-xs text-muted">
      <span>Deliver via</span>
      <label className="inline-flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={app}
          disabled={disabled}
          onChange={(e) => onChange(toggleDeliveryChannel(channel, "app", e.target.checked))}
        />
        In the app
      </label>
      <label className="inline-flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={teams}
          disabled={disabled}
          onChange={(e) => onChange(toggleDeliveryChannel(channel, "teams", e.target.checked))}
        />
        Microsoft Teams
      </label>
    </div>
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
  }, [apiUrl]);

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
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">
        {adminUserId ? "Office alerts (admin)" : "Office alerts"}
      </h2>
      <p className="mb-4 text-sm text-muted">
        Office hours alerts go to Microsoft Teams by default when the agent detects office Wi-Fi
        or you meet your daily target. You can also receive them in the app, or both. Optional
        reminder alerts stay in the app unless you add Teams. Alerts are nudges only, not HR
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
            Turn off to stop all in-app and Teams alerts from My Office Pulse.
          </span>
        </span>
      </label>

      <div className={`space-y-5 ${alertsDisabled ? "pointer-events-none opacity-50" : ""}`}>
        <div>
          <p className="mb-2 text-sm font-medium">Office hours alerts</p>
          <p className="mb-3 text-xs text-muted">
            Default on: Teams when office Wi-Fi is detected, with a monthly progress snapshot,
            and when you meet your daily target.
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
                <DeliveryChannelCheckboxes
                  channel={prefs[row.channelKey]}
                  disabled={!prefs[row.enabledKey]}
                  onChange={(next) => setPrefs({ ...prefs, [row.channelKey]: next })}
                />
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
                Optional schedule-based reminders (usual office days and times are no longer
                editable in Settings). Off by default for this pilot.
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
                  <DeliveryChannelCheckboxes
                    channel={prefs[row.channelKey]}
                    disabled={!prefs[row.enabledKey]}
                    onChange={(next) => setPrefs({ ...prefs, [row.channelKey]: next })}
                  />
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
  );
}

