import type { ReactNode } from "react";
import Link from "next/link";
import { AgentHealthBanner } from "@/components/AgentHealthBanner";
import { AgentVersionUpdateBanner } from "@/components/AgentVersionUpdateBanner";
import type { UserAgentVersionSummary } from "@/lib/agent-update";

type DashboardAlertsProps = {
  agentNeverConnected: boolean;
  ssidMissing: boolean;
  agentStale: boolean;
  agentLowPulses: boolean;
  adminAccess: boolean;
  agentVersionSummary: UserAgentVersionSummary;
  minutesSinceLastSync?: number | null;
  lastSyncedAt?: string | Date | null;
  timezone: string;
};

export function DashboardAlerts({
  agentNeverConnected,
  ssidMissing,
  agentStale,
  agentLowPulses,
  adminAccess,
  agentVersionSummary,
  minutesSinceLastSync,
  lastSyncedAt,
  timezone,
}: DashboardAlertsProps) {
  const alerts: ReactNode[] = [];

  if (!agentNeverConnected && agentVersionSummary.needsUpdate) {
    alerts.push(
      <AgentVersionUpdateBanner key="agent-version" summary={agentVersionSummary} variant="compact" />,
    );
  }

  if (agentNeverConnected) {
    alerts.push(
      <CompactAlert key="setup" tone="orange">
        <p className="text-sm font-medium text-[var(--pwc-orange)]">
          Agent not installed or never connected
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Install the Windows agent from{" "}
          <Link href="/settings#install" className="text-accent hover:underline">
            Settings
          </Link>{" "}
          to record hours automatically.
        </p>
      </CompactAlert>,
    );
  }

  if (adminAccess && !agentNeverConnected && ssidMissing) {
    alerts.push(
      <CompactAlert key="ssid" tone="amber">
        <p className="text-sm font-medium text-amber-400">Wi-Fi SSID not detected</p>
        <p className="mt-0.5 text-xs text-muted">
          Add a <strong>manual visit</strong> at the bottom of this page if detection stays missing
          after the next agent sync (up to ~6 min by default).
        </p>
      </CompactAlert>,
    );
  }

  if (adminAccess && agentStale) {
    alerts.push(
      <div key="stale" className="[&>div]:px-3 [&>div]:py-3 [&>div]:text-sm">
        <AgentHealthBanner
          variant="stale"
          minutesSinceLastPulse={minutesSinceLastSync}
          lastPulseAt={lastSyncedAt}
          timezone={timezone}
        />
      </div>,
    );
  }

  if (adminAccess && !agentStale && agentLowPulses) {
    alerts.push(
      <div key="low" className="[&>div]:px-3 [&>div]:py-3 [&>div]:text-sm">
        <AgentHealthBanner variant="low_pulses" />
      </div>,
    );
  }

  if (alerts.length === 0) return null;

  return <div className="space-y-2">{alerts}</div>;
}

function CompactAlert({
  tone,
  children,
}: {
  tone: "orange" | "amber";
  children: ReactNode;
}) {
  const border =
    tone === "orange" ? "border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange-muted)]" : "border-amber-500/50 bg-amber-500/10";

  return <div className={`rounded-lg border px-3 py-2.5 ${border}`}>{children}</div>;
}
