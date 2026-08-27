"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Device = {
  id: string;
  serialNumber: string;
  label: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type UserSettingsFormProps = {
  timezone: string;
  hoursTarget: number;
  officeSsids: string[];
  maskedToken: string;
  appUrl: string;
  initialPlainToken?: string | null;
  isWelcome?: boolean;
  devices: Device[];
};

export function UserSettingsForm({
  timezone,
  hoursTarget,
  officeSsids,
  maskedToken,
  appUrl,
  initialPlainToken,
  isWelcome,
  devices,
}: UserSettingsFormProps) {
  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [plainToken, setPlainToken] = useState<string | null>(initialPlainToken ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  async function regenerateToken() {
    setRegenerating(true);
    setError(null);
    const res = await fetch("/api/settings/regenerate-token", { method: "POST" });
    setRegenerating(false);
    if (!res.ok) {
      setError("Failed to regenerate token");
      return;
    }
    const data = await res.json();
    setPlainToken(data.token);
  }

  async function copyToken() {
    if (!plainToken) return;
    await navigator.clipboard.writeText(plainToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {isWelcome && (
        <div className="rounded-lg bg-[var(--pwc-orange-muted)] px-4 py-3 text-sm">
          Welcome! Download the PwC Office Pulse agent below, then click &quot;Copy install
          command&quot; and run it in PowerShell.
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Org settings (read-only)</h2>
        <p className="text-sm text-muted">Managed by admin — applies to all users.</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted">Daily hours target</dt>
            <dd className="font-medium">{hoursTarget}h</dd>
          </div>
          <div>
            <dt className="text-muted">Office Wi-Fi SSIDs</dt>
            <dd className="font-mono">{officeSsids.join(", ")}</dd>
          </div>
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Your timezone</h2>
        <input
          type="text"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="w-full max-w-md rounded-lg border px-3 py-2"
        />
        <button type="submit" disabled={loading} className="btn-primary mt-4 px-4 py-2 disabled:opacity-50">
          {loading ? "Saving..." : "Save timezone"}
        </button>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Agent token</h2>
        <p className="mb-4 text-sm text-muted">
          Bcrypt-hashed on server. Only <code>apiUrl</code> + token stored on laptop.
        </p>
        {plainToken ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg border bg-[var(--background)] px-3 py-2 text-xs">
              {plainToken}
            </code>
            <button type="button" onClick={copyToken} className="btn-secondary px-3 py-2 text-sm">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <code className="block break-all rounded-lg border bg-[var(--background)] px-3 py-2 text-xs">
              {maskedToken}
            </code>
            <button
              type="button"
              onClick={regenerateToken}
              disabled={regenerating}
              className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
            >
              {regenerating ? "Regenerating..." : "Regenerate token"}
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">API URL: {appUrl}</p>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Registered laptops</h2>
        <p className="mb-4 text-sm text-muted">
          Auto-registered on first heartbeat. Multiple laptops allowed. Contact admin to remove a
          device.
        </p>
        {devices.length === 0 ? (
          <p className="text-sm text-muted">No laptops registered yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {devices.map((d) => (
              <li key={d.id} className="py-3 text-sm">
                <code className="text-accent">{d.serialNumber}</code>
                {d.lastSeenAt && (
                  <span className="ml-2 text-muted">
                    · last seen {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">Timezone saved.</p>
      )}
    </form>
  );
}
