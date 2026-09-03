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
        <p className="font-medium text-amber-400">Agent is connected but pulses are low</p>
        <p className="mt-1 text-sm text-muted">
          Few heartbeats in the last 24 hours. The laptop may have been asleep, or the scheduled task
          may not be running. From Settings, download the zip, extract it, open PowerShell in that
          folder, and paste the update command. Then check Task Scheduler for{" "}
          <code>PwCOfficePulse</code>.
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
      <p className="font-medium text-red-300">Agent not responding</p>
      <p className="mt-1 text-sm text-muted">
        {minutesSinceLastPulse != null
          ? `No heartbeat for ${formatPulseAge({
              minutes: minutesSinceLastPulse,
              lastPulseAt,
              timezone,
            })}. `
          : "No recent heartbeat detected. "}
        Your office hours are not updating. Download the zip from Settings, extract it, open
        PowerShell in that folder, and paste the update command. If that does not fix it, contact
        your admin.
      </p>
      <ul className="mt-2 list-inside list-disc text-sm text-muted">
        <li>Open Settings and copy the update command</li>
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
