"use client";

import { useEffect, useState } from "react";

type AgentStatus = {
  installStatus: "not_installed" | "waiting" | "connected";
  agentHealthy: boolean;
  lastHeartbeat: string | null;
  inOfficeNow: boolean;
  deviceCount: number;
  pendingTokens: number;
  boundTokens: number;
  devices: Array<{ id: string; serialNumber: string; lastSeenAt: string | null }>;
};

const STATUS_LABELS = {
  not_installed: {
    title: "Agent not detected",
    detail: "Install the agent using the steps below. Nothing has registered yet.",
    color: "text-amber-300",
  },
  waiting: {
    title: "Waiting for first heartbeat",
    detail:
      "Install may have finished. The agent checks in every 2 minutes. Refresh this page shortly.",
    color: "text-blue-300",
  },
  connected: {
    title: "Agent connected",
    detail: "Your laptop is registered and sending heartbeats.",
    color: "text-green-300",
  },
};

export function AgentStatusPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/settings/agent-status");
    if (res.ok) {
      setStatus(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="card p-6">
        <p className="text-sm text-muted">Checking agent status...</p>
      </section>
    );
  }

  if (!status) return null;

  const meta = STATUS_LABELS[status.installStatus];

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-lg font-medium">Agent status</h2>
      <p className={`text-sm font-medium ${meta.color}`}>{meta.title}</p>
      <p className="mt-1 text-sm text-muted">{meta.detail}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Registered laptops</dt>
          <dd>{status.deviceCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Last heartbeat</dt>
          <dd>
            {status.lastHeartbeat
              ? new Date(status.lastHeartbeat).toLocaleString("en-IN")
              : "None yet"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Agent health</dt>
          <dd>{status.agentHealthy ? "Healthy" : status.deviceCount ? "Stale" : "Not installed"}</dd>
        </div>
        <div>
          <dt className="text-muted">In office now</dt>
          <dd>{status.inOfficeNow ? "Yes" : "No"}</dd>
        </div>
      </dl>
      {status.devices.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {status.devices.map((d) => (
            <li key={d.id}>
              <code>{d.serialNumber}</code>
              {d.lastSeenAt && (
                <span className="ml-2 text-muted">
                  last seen {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => {
          setLoading(true);
          load();
        }}
        className="btn-secondary mt-4 px-3 py-1 text-xs"
      >
        Refresh status
      </button>
    </section>
  );
}
