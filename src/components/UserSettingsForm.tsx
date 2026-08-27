"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyToClipboard } from "@/lib/clipboard";

type Device = {
  id: string;
  serialNumber: string;
  label: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type PendingToken = {
  id: string;
  label: string | null;
  prefix: string;
  plainToken: string;
  installCommand: string;
  createdAt: string;
};

type BoundToken = {
  id: string;
  label: string | null;
  prefix: string;
  boundSerialNumber: string | null;
};

type UserSettingsFormProps = {
  timezone: string;
  hoursTarget: number;
  officeSsids: string[];
  appUrl: string;
  isWelcome?: boolean;
  devices: Device[];
  pendingTokens: PendingToken[];
  boundTokens: BoundToken[];
  onDevicesChange: (devices: Device[]) => void;
};

export function UserSettingsForm({
  timezone,
  hoursTarget,
  officeSsids,
  appUrl,
  isWelcome,
  devices,
  pendingTokens,
  boundTokens,
  onDevicesChange,
}: UserSettingsFormProps) {
  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  async function removeDevice(deviceId: string) {
    if (
      !confirm(
        "Remove this laptop from your account? Uninstall the agent on that laptop if you are decommissioning it."
      )
    ) {
      return;
    }

    setRemovingId(deviceId);
    setError(null);
    const res = await fetch(`/api/settings/devices/${deviceId}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) {
      setError("Failed to remove laptop");
      return;
    }
    onDevicesChange(devices.filter((d) => d.id !== deviceId));
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
        <h2 className="mb-2 text-lg font-medium">Laptop install tokens</h2>
        <p className="mb-4 text-sm text-muted">
          Tokens are issued by your admin — one per laptop. Copy the install command and run it
          inside the extracted agent folder. After the first heartbeat, the token binds to that
          laptop&apos;s serial number.
        </p>

        {pendingTokens.length === 0 && boundTokens.length === 0 ? (
          <p className="text-sm text-muted">
            No install tokens yet. Ask your admin to issue one from Admin → Users & tokens.
          </p>
        ) : (
          <div className="space-y-4">
            {pendingTokens.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-amber-200">
                    {t.label ?? "Pending laptop"} · waiting for install
                  </span>
                  <code className="text-xs text-muted">{t.prefix}</code>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Issued {new Date(t.createdAt).toLocaleString("en-IN")}
                </p>
                <pre className="mt-3 overflow-x-auto rounded border bg-[var(--background)] p-3 text-xs whitespace-pre-wrap">
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

            {boundTokens.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Already bound to a laptop</p>
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {boundTokens.map((t) => (
                    <li key={t.id} className="py-2">
                      <span className="font-medium">{t.label ?? "Laptop"}</span>
                      <code className="ml-2 text-xs text-muted">{t.prefix}••••</code>
                      {t.boundSerialNumber && (
                        <code className="ml-2 text-accent">{t.boundSerialNumber}</code>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">API URL: {appUrl}</p>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Registered laptops</h2>
        <p className="mb-4 text-sm text-muted">
          Registered on first heartbeat. Remove a laptop here when you change machines or
          re-image — then ask admin for a new install token if needed.
        </p>
        {devices.length === 0 ? (
          <p className="text-sm text-muted">No laptops registered yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <code className="text-accent">{d.serialNumber}</code>
                {d.lastSeenAt && (
                  <span className="text-muted">
                    last seen {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                  </span>
                )}
                <button
                  type="button"
                  disabled={removingId === d.id}
                  onClick={() => removeDevice(d.id)}
                  className="text-xs text-red-400 hover:underline disabled:opacity-50"
                >
                  {removingId === d.id ? "Removing..." : "Remove laptop"}
                </button>
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
