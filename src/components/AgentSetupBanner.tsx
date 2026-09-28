import Link from "next/link";

export function AgentSetupBanner({ ssidMissing }: { ssidMissing?: boolean }) {
  if (ssidMissing) {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-4">
        <p className="font-medium text-amber-400">Wi-Fi SSID not detected</p>
        <p className="mt-1 text-sm text-muted">
          Common at home or on Ethernet — no action needed if you are not in office. If you are on
          site and hours are missing, wait for the next agent sync or add a manual visit on Today.
          The agent also tries <code>Get-NetConnectionProfile</code> when Location is blocked.
        </p>
        <p className="mt-2 text-xs text-muted">
          Do not ask IT to enable Location unless detection still fails. Many PwC laptops block it
          by policy.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--pwc-orange)] bg-[var(--pwc-orange-muted)] px-4 py-4">
      <p className="font-medium text-[var(--pwc-orange)]">Agent not installed or never connected</p>
      <p className="mt-1 text-sm text-muted">
        Install the Windows agent to record hours. This is your personal dashboard, not admin. Go to
        Settings for the install command in the{" "}
        <strong>Install or reinstall</strong> section.
      </p>
      <Link href="/settings#install" className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
        Open install steps
      </Link>
    </div>
  );
}
