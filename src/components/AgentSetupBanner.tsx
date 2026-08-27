import Link from "next/link";

export function AgentSetupBanner({ ssidMissing }: { ssidMissing?: boolean }) {
  if (ssidMissing) {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-4">
        <p className="font-medium text-amber-400">Agent connected but Wi-Fi SSID not detected</p>
        <p className="mt-1 text-sm text-muted">
          IT may have disabled Location services on this laptop (admin-managed). The agent uses
          alternate Wi-Fi detection (<code>Get-NetConnectionProfile</code>) that does not require
          Location. If SSID is still missing after the next heartbeat (~2 min), use{" "}
          <strong>I&apos;m in office</strong> below or add a manual visit.
        </p>
        <p className="mt-2 text-xs text-muted">
          Do not ask IT to enable Location unless auto-detection still fails — many PwC laptops
          block it by policy.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--pwc-orange)] bg-[var(--pwc-orange-muted)] px-4 py-4">
      <p className="font-medium text-[var(--pwc-orange)]">Agent not installed or never connected</p>
      <p className="mt-1 text-sm text-muted">
        The dashboard stays empty until the Windows heartbeat agent runs on your laptop. This is{" "}
        <strong>your personal dashboard</strong> — not an admin view. Go to Settings to copy your
        install command.
      </p>
      <Link href="/settings" className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
        Open Settings → Install agent
      </Link>
    </div>
  );
}
