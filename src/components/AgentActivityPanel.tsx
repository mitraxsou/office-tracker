"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserAgentActivitySnapshot } from "@/lib/agent-activity-user";
import { AGENT_INSTALL_DIR } from "@/lib/agent-branding";

const TEST_CONNECTION_CMD = `powershell -NoProfile -ExecutionPolicy Bypass -File "${AGENT_INSTALL_DIR.replace(/%LOCALAPPDATA%/g, "$env:LOCALAPPDATA")}\\test-connection.ps1"`;

export function AgentActivityPanel() {
  const [data, setData] = useState<UserAgentActivitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/settings/agent-activity");
    if (!res.ok) {
      setError("Could not load agent activity.");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Loading agent activity…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card p-6">
        <p className="text-sm text-red-400">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Agent activity</h2>
          <p className="mt-1 text-sm text-muted">
            Server agent <strong>v{data.serverAgentVersion}</strong> · API hits today (
            {data.dayKey}, your timezone). Last seen updates when sync or heartbeat succeeds.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-secondary px-3 py-1.5 text-xs">
          Refresh
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-3 text-sm">
        <p className="font-medium">Test connection on this laptop</p>
        <p className="mt-1 text-xs text-muted">
          After install, run in PowerShell (shows config check + one sync cycle and recent log
          lines):
        </p>
        <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background)] p-2 text-xs whitespace-pre-wrap">
          {TEST_CONNECTION_CMD}
        </pre>
      </div>

      {data.devices.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No laptops registered yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
          {data.devices.map((d) => (
            <li key={d.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-accent">{d.serialNumber}</code>
                {d.label && <span className="text-muted">{d.label}</span>}
                {d.tokenPrefix && (
                  <span className="text-xs text-muted">token {d.tokenPrefix}…</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Agent reported:{" "}
                {d.agentScriptVersion ? `v${d.agentScriptVersion}` : "unknown"}
                {d.agentScriptVersion &&
                d.agentScriptVersion !== data.serverAgentVersion ? (
                  <span className="text-[var(--pwc-orange)]">
                    {" "}
                    (server v{data.serverAgentVersion})
                  </span>
                ) : d.agentScriptVersion ? (
                  <span className="text-green-400/90"> · matches server</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted">
                Last seen:{" "}
                {d.lastSeenAt
                  ? new Date(d.lastSeenAt).toLocaleString("en-IN", { timeZone: data.timezone })
                  : "never"}
              </p>
              <p className="mt-1 text-xs">
                Hits today: sync {d.hitsToday.sync}, heartbeat {d.hitsToday.heartbeat}, config{" "}
                {d.hitsToday.config}
                {d.hitsToday.total === 0 && (
                  <span className="text-amber-300"> · no API hits yet today</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
