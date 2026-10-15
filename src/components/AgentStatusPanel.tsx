"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { InstallTokenCommands } from "@/components/InstallTokenCommands";
import type { InstallTokenForUser } from "@/lib/install-token-types";
import { formatPulseAge } from "@/lib/pulse-age";

type WifiSample = {
  at: string;
  ssid: string | null;
  officeSsid: boolean | null;
  storedInOffice: boolean;
  source: string;
  sourceLabel: string;
};

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
  lastSuccessfulSync: {
    at: string;
    trigger: string | null;
    triggerLabel: string | null;
    deviceId: string | null;
    serialNumber: string | null;
  } | null;
  lastDeviceContactAt: string | null;
  lastWifiSample: WifiSample | null;
  lastActivityTick: {
    at: string;
    ssid: string | null;
    officeSsid: boolean | null;
    inOffice: boolean;
  } | null;
  minutesSinceLastActivityTick: number | null;
  openVisit: {
    startAt: string;
    ssid: string | null;
    officeSsid: boolean | null;
    source: string;
    sourceLabel: string;
  } | null;
  inOfficeNowRule: string;
  inOfficeNowSignal: {
    at: string;
    ssid: string | null;
    officeSsid: boolean | null;
    inOffice: boolean;
    source: string;
    sourceLabel: string;
  } | null;
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
    color: "text-accent",
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

function formatStamp(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "None stored";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "None stored";
  return date.toLocaleString("en-IN", { timeZone: timezone });
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function officeSsidText(officeSsid: boolean | null): string {
  if (officeSsid === null) return "No SSID stored";
  return officeSsid ? "Office SSID: Yes" : "Office SSID: No";
}

function ssidText(ssid: string | null): string {
  return ssid ?? "none";
}

function EvidenceRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-t border-[var(--border)] py-3 sm:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] sm:gap-4">
      <dt>
        <span className="font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

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
  const tick = status.lastActivityTick;
  const wifi = status.lastWifiSample;
  const signal = status.inOfficeNowSignal;
  const openVisit = status.openVisit;

  return (
    <section id="agent" className="scroll-mt-header card p-6">
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
            Only {status.pulsesLast24h} activity ticks reached the server in the last 24 hours
            (expected ~{status.expectedPulsesPerDay} when uploads are flowing). Working from home is
            fine. This warning means sync itself looks incomplete.{" "}
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
          <dt className="text-muted">Registered laptops</dt>
          <dd>{status.deviceCount}</dd>
        </div>
      </dl>

      <div className="mt-4 border-l-4 border-l-[var(--pwc-orange)] pl-3">
        <p className="text-sm font-medium text-accent">Sync and presence times</p>
        <p className="mt-1 text-xs text-muted">
          Each row is a different stored event, with its own timestamp.
        </p>
        <dl className="mt-1">
          <EvidenceRow
            label="Last successful server sync"
            hint="Server receipt time of the latest accepted sync batch."
          >
            {status.lastSuccessfulSync ? (
              <>
                <p className="font-medium tabular-nums">
                  {formatStamp(status.lastSuccessfulSync.at, status.timezone)}
                </p>
                <p className="text-xs text-muted">
                  {status.lastSuccessfulSync.triggerLabel ?? "Sync batch (no trigger stored)"}
                  {status.lastSuccessfulSync.serialNumber
                    ? ` · laptop ${status.lastSuccessfulSync.serialNumber}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-muted">None recorded</p>
            )}
          </EvidenceRow>

          <EvidenceRow
            label="Last device contact"
            hint="Newest device lastSeenAt on this account. Server time the laptop reached heartbeat or sync."
          >
            {status.lastDeviceContactAt ? (
              <p className="font-medium tabular-nums">
                {formatStamp(status.lastDeviceContactAt, status.timezone)}
              </p>
            ) : (
              <p className="text-muted">None yet</p>
            )}
          </EvidenceRow>

          <EvidenceRow
            label="Last Wi-Fi/presence sample"
            hint="Newest stored Wi-Fi or presence row."
          >
            {wifi ? (
              <>
                <p className="font-medium tabular-nums">
                  {formatStamp(wifi.at, status.timezone)}
                </p>
                <p className="text-xs text-muted">{wifi.sourceLabel}</p>
                <p className="mt-1 text-xs">
                  SSID:{" "}
                  <code className="break-all">{ssidText(wifi.ssid)}</code>
                  {" · "}
                  <span
                    className={
                      wifi.officeSsid
                        ? "rounded bg-[var(--pwc-orange-muted)] px-1.5 py-0.5 text-[var(--pwc-orange)]"
                        : ""
                    }
                  >
                    {officeSsidText(wifi.officeSsid)}
                  </span>
                  {" · "}
                  Stored in-office flag: {yesNo(wifi.storedInOffice)}
                </p>
              </>
            ) : (
              <p className="text-muted">None stored</p>
            )}
          </EvidenceRow>

          <EvidenceRow
            label="Last activity tick"
            hint="Newest stored activity tick from the agent."
          >
            {tick ? (
              <>
                <p className="font-medium tabular-nums">
                  {formatStamp(tick.at, status.timezone)}
                </p>
                <p className="mt-1 text-xs">
                  SSID:{" "}
                  <code className="break-all">{ssidText(tick.ssid)}</code>
                  {" · "}
                  <span
                    className={
                      tick.officeSsid
                        ? "rounded bg-[var(--pwc-orange-muted)] px-1.5 py-0.5 text-[var(--pwc-orange)]"
                        : ""
                    }
                  >
                    {officeSsidText(tick.officeSsid)}
                  </span>
                  {" · "}
                  In office flag: {yesNo(tick.inOffice)}
                </p>
              </>
            ) : (
              <p className="text-muted">None stored</p>
            )}
          </EvidenceRow>

          <EvidenceRow
            label="Time since last activity tick"
            hint="Age of the activity tick above."
          >
            {tick ? (
              <p>
                {formatPulseAge({
                  minutes: status.minutesSinceLastActivityTick,
                  lastPulseAt: tick.at,
                  timezone: status.timezone,
                })}
              </p>
            ) : (
              <p className="text-muted">No activity tick stored</p>
            )}
          </EvidenceRow>

          <EvidenceRow
            label="In office now"
            hint="Same flag as the dashboard."
          >
            <p className="font-medium">{status.inOfficeNow ? "Yes" : "No"}</p>
            <p className="mt-1 text-xs text-muted">{status.inOfficeNowRule}</p>
            {signal ? (
              <p className="mt-1 text-xs">
                Signal used: {signal.sourceLabel}, {formatStamp(signal.at, status.timezone)}, SSID{" "}
                <code className="break-all">{ssidText(signal.ssid)}</code>,{" "}
                {signal.inOffice ? "in the office" : "not in the office"}. {officeSsidText(signal.officeSsid)}.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">No live presence signal stored.</p>
            )}
          </EvidenceRow>

          <EvidenceRow
            label="Open office visit"
            hint="Visit row that still has no end time."
          >
            {openVisit ? (
              <>
                <p className="font-medium tabular-nums">
                  Open since {formatStamp(openVisit.startAt, status.timezone)}
                </p>
                <p className="mt-1 text-xs">
                  {openVisit.sourceLabel}
                  {" · "}
                  SSID:{" "}
                  <code className="break-all">{ssidText(openVisit.ssid)}</code>
                  {" · "}
                  {officeSsidText(openVisit.officeSsid)}
                </p>
              </>
            ) : (
              <p className="text-muted">None</p>
            )}
          </EvidenceRow>
        </dl>
      </div>

      {status.devices.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">
            Each line is that laptop&apos;s own last contact (lastSeenAt). The account row above is
            the newest of these.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {status.devices.map((device) => (
              <li key={device.id}>
                <code>{device.serialNumber}</code>
                <span className="ml-2 text-muted">
                  {device.lastSeenAt
                    ? `last contact ${formatStamp(device.lastSeenAt, status.timezone)}`
                    : "no contact yet"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm">
        <p className="font-medium">Check my laptop log</p>
        <p className="mt-1 text-muted">
          On this laptop, open{" "}
          <code>%LOCALAPPDATA%\OfficeTracker\logs\last-run-summary.txt</code> first (plain
          English). For detail, open <code>heartbeat.log</code> in the same folder and search for{" "}
          <code>[DIAG/RESUME]</code>, <code>[DIAG/SSID]</code>, or <code>[DIAG/VISIT]</code>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Requires agent 1.5.23 or newer. Press Win+R, paste the path, Enter. Update the agent from
          Settings if those files are missing.
        </p>
      </div>

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
