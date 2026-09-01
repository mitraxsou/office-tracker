"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyToClipboard } from "@/lib/clipboard";
import { timezoneOptionsForUser } from "@/lib/constants";

import type { EnrichedDevice } from "@/lib/device-enrichment";
import { agentStatusClass } from "@/lib/device-enrichment";

import type { InstallTokenForUser } from "@/lib/install-token-types";

type Device = EnrichedDevice;

type UserSettingsFormProps = {
  timezone: string;
  hoursTarget: number;
  monthlyDaysTarget: number;
  appUrl: string;
  isWelcome?: boolean;
  devices: Device[];
  installTokens: InstallTokenForUser[];
  onDevicesChange: (devices: Device[]) => void;
};

export function UserSettingsForm({
  timezone,
  hoursTarget,
  monthlyDaysTarget,
  appUrl,
  isWelcome,
  devices,
  installTokens,
  onDevicesChange,
}: UserSettingsFormProps) {
  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save settings");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  async function handleCopy(text: string, tokenId: string) {
    const ok = await copyToClipboard(text);
    if (!ok) {
      setError("Could not copy. Select the text and press Ctrl+C.");
      return;
    }
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function requestDeviceRemoval(deviceId: string, serialNumber: string) {
    const reason = prompt(
      `Request removal of laptop ${serialNumber}? An admin must approve before it is removed.\n\nOptional reason:`,
    );
    if (reason === null) return;

    setRemovingId(deviceId);
    setError(null);
    setSuccessMessage(null);
    const res = await fetch(`/api/settings/devices/${deviceId}/removal-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reason.trim() || undefined }),
    });
    setRemovingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit removal request");
      return;
    }
    setSuccessMessage("Removal request sent to admin for review.");
    onDevicesChange(
      devices.map((d) => (d.id === deviceId ? { ...d, pendingRemoval: true } : d)),
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {isWelcome && (
        <div className="rounded-lg bg-[var(--pwc-orange-muted)] px-4 py-3 text-sm">
          Account created. If your admin issued an install token, it appears below. Follow the
          numbered install steps to set up the agent on your laptop.
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Org settings (read-only)</h2>
        <p className="text-sm text-muted">Set by admin. Applies to all users.</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted">Daily hours target</dt>
            <dd className="font-medium">{hoursTarget}h</dd>
          </div>
          <div>
            <dt className="text-muted">Monthly office days target</dt>
            <dd className="font-medium">{monthlyDaysTarget} days</dd>
          </div>
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Your timezone</h2>
        <p className="mb-3 text-sm text-muted">
          Used for today&apos;s hours, visit times, and notification schedule (office days and
          alert times).
        </p>
        <label className="block text-sm">
          <span className="text-muted">Timezone</span>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="mt-1 block w-full max-w-md rounded-lg border px-3 py-2"
          >
            {timezoneOptionsForUser(timezone).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading} className="btn-primary mt-4 px-4 py-2 disabled:opacity-50">
          {loading ? "Saving..." : "Save timezone"}
        </button>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Laptop install tokens</h2>
        <p className="mb-4 text-sm text-muted">
          One token per laptop. Copy the install command to set up or reinstall the agent without
          asking admin again. After the first heartbeat, the token binds to that laptop&apos;s
          serial number.
        </p>

        {installTokens.length === 0 ? (
          <p className="text-sm text-muted">
            No install tokens yet. Ask your admin to issue one from Admin → Users & tokens.
          </p>
        ) : (
          <div className="space-y-4">
            {installTokens.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg border p-4 text-sm ${
                  t.status === "pending"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-[var(--border)] bg-[var(--background)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-medium ${
                      t.status === "pending" ? "text-amber-200" : "text-foreground"
                    }`}
                  >
                    {t.label ?? "Laptop token"}
                  </span>
                  <code className="text-xs text-muted">{t.prefix}</code>
                  {t.status === "bound" && t.boundSerialNumber ? (
                    <span className="rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
                      Bound to {t.boundSerialNumber}
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                      Waiting for first install
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Issued {new Date(t.createdAt).toLocaleString("en-IN")}
                </p>
                <pre className="mt-3 overflow-x-auto rounded border bg-[var(--background-elevated)] p-3 text-xs whitespace-pre-wrap">
                  {t.installCommand}
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(t.installCommand, t.id)}
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    {copiedId === t.id ? "Copied!" : "Copy install command"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(t.plainToken, `${t.id}-token`)}
                    className="btn-secondary px-3 py-1 text-xs"
                  >
                    {copiedId === `${t.id}-token` ? "Copied!" : "Copy token"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">API URL: {appUrl}</p>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Registered laptops</h2>
        <p className="mb-4 text-sm text-muted">
          Registered on first heartbeat. To remove a laptop, submit a request — an admin must
          approve it (prevents accidental removal).
        </p>
        {devices.length === 0 ? (
          <p className="text-sm text-muted">No laptops registered yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {devices.map((d) => (
              <li key={d.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="text-accent">{d.serialNumber}</code>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      d.pendingRemoval
                        ? "bg-amber-500/20 text-amber-300"
                        : `${agentStatusClass(d.agentStatus)} bg-[var(--background)]`
                    }`}
                  >
                    {d.pendingRemoval ? "Removal pending" : d.agentStatusLabel}
                  </span>
                  {d.boundTokenLabel && (
                    <span className="text-xs text-muted">Token: {d.boundTokenLabel}</span>
                  )}
                </div>
                {d.lastSeenAt && (
                  <p className="mt-1 text-xs text-muted">
                    Last heartbeat {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                  </p>
                )}
                {!d.pendingRemoval && (
                  <button
                    type="button"
                    disabled={removingId === d.id}
                    onClick={() => requestDeviceRemoval(d.id, d.serialNumber)}
                    className="mt-2 text-xs text-red-400 hover:underline disabled:opacity-50"
                  >
                    {removingId === d.id ? "Submitting..." : "Request removal"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {successMessage && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{successMessage}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">Timezone saved.</p>
      )}
    </form>
  );
}
