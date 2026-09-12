"use client";

import { useCallback, useEffect, useState } from "react";

type AgentGraceState = {
  globalGraceHours: number;
  userGraceHours: number | null;
  effectiveGraceHours: number;
};

export function AgentGraceSection({ adminUserId }: { adminUserId?: string } = {}) {
  const apiUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/agent-grace`
    : "/api/settings/agent-grace";
  const [state, setState] = useState<AgentGraceState | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [customHours, setCustomHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      setError("Failed to load agent grace settings");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as AgentGraceState;
    setState(data);
    setUseCustom(data.userGraceHours !== null);
    setCustomHours(data.userGraceHours ?? data.globalGraceHours);
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(apiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentStaleGraceHours: useCustom ? customHours : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    const data = (await res.json()) as AgentGraceState;
    setState(data);
    setMessage("Agent health grace period saved.");
  }

  if (loading || !state) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Loading agent grace settings...</p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">
        {adminUserId ? "Agent health grace (admin)" : "Agent health grace"}
      </h2>
      <p className="mb-4 text-sm text-muted">
        How long without agent sync or activity before the agent is flagged as stale. Default is{" "}
        {state.globalGraceHours} hours (1 day). Increase for shift workers or travel when laptop
        sleep is expected.
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <p className="text-sm text-muted">
          Currently effective: <strong>{state.effectiveGraceHours} hours</strong>
          {state.userGraceHours === null && " (global default)"}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
          />
          Use a custom grace period
        </label>
        {useCustom && (
          <label className="block text-sm">
            <span className="text-muted">Grace period (hours)</span>
            <input
              type="number"
              min={1}
              max={168}
              value={customHours}
              onChange={(e) => setCustomHours(Number(e.target.value))}
              className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
            />
          </label>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-green-400">{message}</p>}
        <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
          {busy ? "Saving..." : "Save grace period"}
        </button>
      </form>
    </section>
  );
}
