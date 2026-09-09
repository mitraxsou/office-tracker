"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyToClipboard } from "@/lib/clipboard";

type IntegrationKeyRow = {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdByEmail: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminIntegrationKeys({
  initialKeys,
  webhookConfigured,
  envSecretConfigured,
}: {
  initialKeys: IntegrationKeyRow[];
  webhookConfigured: boolean;
  envSecretConfigured: boolean;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ key: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNewKey(null);

    const res = await fetch("/api/admin/integration-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });

    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to generate secret");
      return;
    }

    setNewKey({ key: data.key, label: data.label });
    setLabel("");
    setKeys((prev) => {
      const now = new Date().toISOString();
      return [
        {
          id: data.id,
          label: data.label,
          keyPrefix: data.keyPrefix,
          createdAt: now,
          revokedAt: null,
          lastUsedAt: null,
          createdByEmail: "",
        },
        ...prev.map((key) => (key.revokedAt ? key : { ...key, revokedAt: now })),
      ];
    });
    router.refresh();
  }

  async function handleCopyKey() {
    if (!newKey) return;
    const ok = await copyToClipboard(newKey.key);
    if (!ok) {
      setError("Could not copy. Select the key and press Ctrl+C.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this webhook secret? Power Automate notifications will stop working.")) {
      return;
    }

    setRevokingId(id);
    setError(null);

    const res = await fetch(`/api/admin/integration-keys?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    setRevokingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to revoke secret");
      return;
    }

    setKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k,
      ),
    );
    router.refresh();
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setTestMessage(null);
    const res = await fetch("/api/admin/integration-keys/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setTesting(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send test notification");
      return;
    }
    setTestMessage("Test notification sent to your admin email.");
    router.refresh();
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);
  const secretReady = envSecretConfigured || activeKeys.length > 0;

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Power Automate webhook secret</h2>
      <p className="mb-4 text-sm text-muted">
        Generate one shared secret for the Power Automate trigger Condition. My Office Pulse sends
        the same value in <code className="rounded bg-[var(--border)] px-1">X-Office-Pulse-Token</code>.
        The secret is shown once. Generating a new secret revokes the current one.
      </p>

      {envSecretConfigured && (
        <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          <span className="font-medium">POWER_AUTOMATE_WEBHOOK_SECRET</span> is set in the server
          environment and takes precedence over any secret generated below. Update the Power
          Automate Condition to match that value.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3">
        <div className="text-sm">
          <span className="font-medium">Webhook URL: </span>
          <span className={webhookConfigured ? "text-green-400" : "text-amber-300"}>
            {webhookConfigured ? "Configured" : "Not configured"}
          </span>
          <p className="mt-1 text-xs text-muted">The URL is read from the server environment and is never displayed.</p>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !webhookConfigured || !secretReady}
          className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
        >
          {testing ? "Sending..." : "Send test notification"}
        </button>
      </div>

      <form onSubmit={handleGenerate} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="block min-w-[200px] flex-1 text-sm">
          <span className="text-muted">Label</span>
          <input
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Power Automate production"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
          {loading ? "Generating..." : "Generate new secret"}
        </button>
      </form>

      {newKey && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="mb-2 text-sm font-medium text-amber-200">
            Secret created for &quot;{newKey.label}&quot;. Copy it now. It will not be shown again.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded bg-[var(--border)] px-2 py-1 font-mono text-sm">
              {newKey.key}
            </code>
            <button type="button" onClick={handleCopyKey} className="btn-secondary px-3 py-1.5 text-sm">
              {copied ? "Copied" : "Copy secret"}
            </button>
            <button
              type="button"
              onClick={() => setNewKey(null)}
              className="text-sm text-muted hover:text-[var(--foreground)]"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Paste the full value into the first Power Automate Condition. Compare it with header{" "}
            <code className="rounded bg-[var(--border)] px-1">X-Office-Pulse-Token</code>.
          </p>
        </div>
      )}

      {testMessage && <p className="mb-4 text-sm text-green-400">{testMessage}</p>}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-muted">
              <th className="py-2 pr-4 font-medium">Label</th>
              <th className="py-2 pr-4 font-medium">Prefix</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 pr-4 font-medium">Last used</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {activeKeys.length === 0 && !envSecretConfigured && (
              <tr>
                <td colSpan={5} className="py-4 text-muted">
                  No active secret. Set POWER_AUTOMATE_WEBHOOK_SECRET in Vercel, or generate one
                  above and paste it into the Power Automate Condition.
                </td>
              </tr>
            )}
            {activeKeys.length === 0 && envSecretConfigured && (
              <tr>
                <td colSpan={5} className="py-4 text-muted">
                  Using the server environment secret. DB-generated secrets below are optional
                  fallbacks when the env var is unset.
                </td>
              </tr>
            )}
            {activeKeys.map((key) => (
              <tr key={key.id} className="border-b border-[var(--border)]/50">
                <td className="py-2 pr-4">{key.label}</td>
                <td className="py-2 pr-4 font-mono text-xs">{key.keyPrefix}…</td>
                <td className="py-2 pr-4 text-muted">{formatDate(key.createdAt)}</td>
                <td className="py-2 pr-4 text-muted">{formatDate(key.lastUsedAt)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    disabled={revokingId === key.id}
                    onClick={() => handleRevoke(key.id)}
                    className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {revokingId === key.id ? "Revoking..." : "Revoke"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {revokedKeys.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted">
            Revoked secrets ({revokedKeys.length})
          </summary>
          <table className="mt-2 w-full text-left text-sm">
            <tbody>
              {revokedKeys.map((key) => (
                <tr key={key.id} className="border-b border-[var(--border)]/30 text-muted">
                  <td className="py-2 pr-4 line-through">{key.label}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{key.keyPrefix}…</td>
                  <td className="py-2 pr-4">{formatDate(key.revokedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
