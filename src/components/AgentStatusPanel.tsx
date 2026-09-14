"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InstallTokenCommands } from "@/components/InstallTokenCommands";
import type { InstallTokenForUser } from "@/lib/install-token-types";
import { formatPulseAge } from "@/lib/pulse-age";

type AgentStatus = {
  installStatus: "not_installed" | "waiting" | "connected";
  agentHealthy: boolean;
  pulseStatus: "healthy" | "stale" | "none";
  lastHeartbeat: string | null;
  timezone: string;
  inOfficeNow: boolean;
  deviceCount: number;
  pendingTokens: number;
  boundTokens: number;
  pulsesLast24h: number;
  expectedPulsesPerDay: number;
  showLowActivityWarning: boolean;
  minutesSinceLastPulse: number | null;
  recentPulses: Array<{ recordedAt: string; inOffice: boolean; ssid: string | null }>;
  devices: Array<{ id: string; serialNumber: string; lastSeenAt: string | null }>;
};

const STATUS_LABELS = {
  not_installed: {
    title: "Agent not detected",
    detail: "Install the agent using the steps below. Nothing has registered yet.",
    color: "text-amber-300",
  },
  waiting: {
    title: "Waiting for first sync",
    detail:
      "Install may have finished. The agent syncs about every 5 minutes by default. Use Refresh status below.",
    color: "text-blue-300",
  },
  connected: {
    title: "Agent connected",
    detail: "Your laptop is registered and syncing regularly.",
    color: "text-green-300",
  },
};

const SYNC_LABELS = {
  healthy: { text: "Syncing regularly", color: "text-green-400" },
  stale: {
    text: "Not responding - update below or contact admin",
    color: "text-red-300",
  },
  none: { text: "No activity received yet", color: "text-muted" },
};

type AgentStatusPanelProps = {
  installTokens?: InstallTokenForUser[];
  legacyBoundCount?: number;
  appUrl?: string;
};

export function AgentStatusPanel({
  installTokens = [],
  legacyBoundCount = 0,
  appUrl,
}: AgentStatusPanelProps = {}) {
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
  const syncMeta = SYNC_LABELS[status.pulseStatus];
  const showReinstall =
    status.pulseStatus === "stale" ||
    status.installStatus === "not_installed" ||
    status.installStatus === "waiting";

  return (
    <section id="agent" className="scroll-mt-6 card p-6">
      <h2 className="mb-1 text-lg font-medium">Agent status</h2>
      <p className={`text-sm font-medium ${meta.color}`}>{meta.title}</p>
      <p className="mt-1 text-sm text-muted">{meta.detail}</p>
      <p className={`mt-2 text-sm font-medium ${syncMeta.color}`}>{syncMeta.text}</p>

      {showReinstall && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-muted">
          <p className="font-medium text-red-200">
            {status.pulseStatus === "stale" ? "Update the agent" : "Install the agent"}
          </p>
          <p className="mt-1">
            {status.pulseStatus === "stale"
              ? "Copy the setup command below and run it in PowerShell to refresh the agent."
              : "Use the setup command below to register this laptop."}
          </p>
          <div className="mt-3">
            <InstallTokenCommands
              installTokens={installTokens}
              legacyBoundCount={legacyBoundCount}
              compact
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="#install" className="btn-primary px-3 py-1.5 text-xs">
              Full install steps
            </a>
            <Link href="/help#troubleshooting" className="btn-secondary px-3 py-1.5 text-xs">
              Troubleshooting help
            </Link>
          </div>
          {appUrl && (
            <p className="mt-2 text-xs">
              Confirm Task Scheduler has <code>PwCOfficePulse</code>. API URL: {appUrl}
            </p>
          )}
        </div>
      )}

      {status.showLowActivityWarning && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-muted">
          <p>
            Only {status.pulsesLast24h} activity ticks in the last 24 hours (expected ~
            {status.expectedPulsesPerDay}). The laptop may have been asleep or the task may not be
            running reliably.{" "}
            <a href="#install" className="text-accent hover:underline">
              Reinstall from here
            </a>
            .
          </p>
        </div>
      )}

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Activity ticks last 24h</dt>
          <dd>
            {status.pulsesLast24h} / ~{status.expectedPulsesPerDay} expected
          </dd>
        </div>
        <div>
          <dt className="text-muted">Last seen</dt>
          <dd>
            {status.lastHeartbeat
              ? new Date(status.lastHeartbeat).toLocaleString("en-IN")
              : "None yet"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Time since last activity</dt>
          <dd>
            {formatPulseAge({
              minutes: status.minutesSinceLastPulse,
              lastPulseAt: status.lastHeartbeat,
              timezone: status.timezone,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-muted">In office now</dt>
          <dd>{status.inOfficeNow ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted">Registered laptops</dt>
          <dd>{status.deviceCount}</dd>
        </div>
      </dl>

      {status.recentPulses.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-muted">Recent activity</p>
          <ul className="space-y-1 text-xs text-muted">
            {status.recentPulses.map((p, i) => (
              <li key={i}>
                {new Date(p.recordedAt).toLocaleTimeString("en-IN")} ·{" "}
                {p.inOffice ? "in office" : "out"}
                {p.ssid ? ` · ${p.ssid}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

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
