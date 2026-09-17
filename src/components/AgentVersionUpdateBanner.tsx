import Link from "next/link";
import type { UserAgentVersionSummary } from "@/lib/agent-update";
import { AGENT_PRODUCT_NAME } from "@/lib/agent-branding";

type AgentVersionUpdateBannerProps = {
  summary: UserAgentVersionSummary;
  variant?: "compact" | "full";
};

export function AgentVersionUpdateBanner({
  summary,
  variant = "full",
}: AgentVersionUpdateBannerProps) {
  if (!summary.needsUpdate) return null;

  const onlyPending = summary.devices.every((d) => !d.stale && d.updatePending);
  const versionLines = summary.devices
    .filter((d) => d.stale)
    .map((d) =>
      d.reportedVersion
        ? `${d.serialNumber}: v${d.reportedVersion}`
        : `${d.serialNumber}: version not reported yet`,
    );

  if (variant === "compact") {
    return (
      <div className="rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange-muted)] px-3 py-2.5">
        <p className="text-sm font-medium text-[var(--pwc-orange)]">
          {AGENT_PRODUCT_NAME} update available (server v{summary.serverVersion})
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {onlyPending
            ? "An admin queued an update—your laptop should reinstall on the next sync (within about 15 minutes). You can also update now from "
            : "Your laptop agent is behind. Download the latest zip and run your reinstall command from "}
          <Link href="/settings#install" className="text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange)]/10 px-4 py-4">
      <p className="font-medium text-[var(--pwc-orange)]">
        Update your laptop agent to v{summary.serverVersion}
      </p>
      <p className="mt-1 text-sm text-muted">
        {onlyPending ? (
          <>
            Your admin requested an agent refresh. If sync is healthy, the laptop should download
            and reinstall automatically within about 15 minutes. To update immediately, use the
            steps below.
          </>
        ) : (
          <>
            The server is running agent <strong>v{summary.serverVersion}</strong>, but at least one
            registered laptop is on an older or unknown version. Office tracking may be incomplete
            until you update.
          </>
        )}
      </p>
      {versionLines.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-muted">
          {versionLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>
          Open{" "}
          <Link href="/settings#install" className="text-accent hover:underline">
            Settings → Install agent
          </Link>
        </li>
        <li>Download the agent zip, extract it, and open PowerShell in that folder</li>
        <li>Copy your <strong>reinstall command</strong> from Settings and run it in PowerShell</li>
      </ol>
      <Link href="/settings#install" className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
        Go to install &amp; update
      </Link>
    </div>
  );
}
