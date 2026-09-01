"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSettingsForm({
  hoursTarget,
  officeSsids,
  maxDevicesPerUser,
  pendingTokenTtlDays,
  heartbeatRetentionDays,
  agentStaleMinutes,
}: {
  hoursTarget: number;
  officeSsids: string[];
  maxDevicesPerUser: number;
  pendingTokenTtlDays: number;
  heartbeatRetentionDays: number;
  agentStaleMinutes: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(hoursTarget);
  const [ssidText, setSsidText] = useState(officeSsids.join("\n"));
  const [maxDevices, setMaxDevices] = useState(maxDevicesPerUser);
  const [tokenTtl, setTokenTtl] = useState(pendingTokenTtlDays);
  const [heartbeatRetention, setHeartbeatRetention] = useState(heartbeatRetentionDays);
  const [staleMinutes, setStaleMinutes] = useState(agentStaleMinutes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        officeSsids: ssidList,
        maxDevicesPerUser: maxDevices,
        pendingTokenTtlDays: tokenTtl,
        heartbeatRetentionDays: heartbeatRetention,
        agentStaleMinutes: staleMinutes,
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
        <h2 className="mb-4 text-lg font-medium">Global daily hours target</h2>
        <input
          type="number"
          min={0.5}
          max={24}
          step={0.5}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full max-w-xs rounded-lg border px-3 py-2"
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Office Wi-Fi SSIDs (global)</h2>
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
        <h2 className="mb-2 text-lg font-medium">Agent & token settings</h2>
        <p className="mb-4 text-sm text-muted">
          Pending install tokens auto-revoke if never bound. Raw heartbeats are purged after the
          retention window (visits are kept).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
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
            <span className="text-muted">Heartbeat retention (days)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={heartbeatRetention}
              onChange={(e) => setHeartbeatRetention(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Agent stale after (minutes)</span>
            <input
              type="number"
              min={2}
              max={60}
              value={staleMinutes}
              onChange={(e) => setStaleMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Global config saved.</p>}

      <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
        {loading ? "Saving..." : "Save global config"}
      </button>
    </form>
  );
}
