import Link from "next/link";
import { formatPulseAge } from "@/lib/pulse-age";

type AgentHealthBannerProps = {
  variant: "never_connected" | "stale" | "low_pulses";
  minutesSinceLastPulse?: number | null;
  lastPulseAt?: string | Date | null;
  timezone?: string;
};

export function AgentHealthBanner({
  variant,
  minutesSinceLastPulse,
  lastPulseAt,
  timezone,
}: AgentHealthBannerProps) {
  if (variant === "never_connected") {
    return (
      <div className="rounded-lg border border-[var(--pwc-orange)] bg-[var(--pwc-orange-muted)] px-4 py-4">
        <p className="font-medium text-[var(--pwc-orange)]">Agent not installed or never connected</p>
        <p className="mt-1 text-sm text-muted">
          Office hours are not being tracked automatically. Install the Windows agent from Settings.
        </p>
        <Link href="/settings#install" className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
          Open Settings and install
        </Link>
      </div>
    );
  }

  if (variant === "low_pulses") {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-4">
        <p className="font-medium text-amber-400">Agent is syncing but office activity is low</p>
        <p className="mt-1 text-sm text-muted">
          Your laptop is syncing with the server, but few in-office ticks were recorded in the last
          24 hours. You may be working from home, or the laptop was asleep most of the day. Office
          hours only count on office Wi-Fi.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/settings#install" className="btn-primary px-4 py-2 text-sm">
            Update from Settings
          </Link>
          <Link href="/help" className="btn-secondary px-4 py-2 text-sm">
            Troubleshooting help
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-4">
      <p className="font-medium text-red-300">Agent not syncing</p>
      <p className="mt-1 text-sm text-muted">
        {minutesSinceLastPulse != null
          ? `No successful sync for ${formatPulseAge({
              minutes: minutesSinceLastPulse,
              lastPulseAt,
              timezone,
            })}. `
          : "No recent agent sync detected. "}
        The dashboard only updates when your laptop agent POSTs to the server. Copy the setup
        command from Settings and run it in PowerShell. If that does not fix it, contact your admin.
      </p>
      <ul className="mt-2 list-inside list-disc text-sm text-muted">
        <li>Open Settings and copy the setup command</li>
        <li>Confirm Task Scheduler has a task named <code>PwCOfficePulse</code></li>
        <li>Check <code>%LOCALAPPDATA%\OfficeTracker\logs\heartbeat.log</code> on the laptop</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/settings#install" className="btn-primary px-4 py-2 text-sm">
          Update from Settings
        </Link>
        <Link href="/help" className="btn-secondary px-4 py-2 text-sm">
          Troubleshooting help
        </Link>
      </div>
    </div>
  );
}
