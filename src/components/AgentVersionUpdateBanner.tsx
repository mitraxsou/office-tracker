import Link from "next/link";
import type { UserAgentVersionSummary } from "@/lib/agent-update";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_PRODUCT_NAME,
  formatAgentZipDownloadFilename,
} from "@/lib/agent-branding";

type AgentVersionUpdateBannerProps = {
  summary: UserAgentVersionSummary;
  variant?: "compact" | "full";
};

function AgentZipReinstallSteps({ serverVersion }: { serverVersion: string }) {
  const zipName = formatAgentZipDownloadFilename(serverVersion);
  return (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
      <li>
        Download{" "}
        <a href="/api/agent/download" className="text-accent hover:underline">
          <code>{zipName}</code>
        </a>{" "}
        (agent <strong>v{serverVersion}</strong>) from this site — or use the same download on{" "}
        <Link href="/settings#install" className="text-accent hover:underline">
          Settings → Install
        </Link>
        .
      </li>
      <li>
        Extract the zip (<strong>Extract All</strong>). Open the folder that contains{" "}
        <code>setup.ps1</code> and <code>lib\</code> (often <code>{AGENT_EXTRACT_FOLDER}</code>).
      </li>
      <li>
        In that folder, open <strong>PowerShell</strong> (not Command Prompt).
      </li>
      <li>
        On Settings, copy your <strong>reinstall command</strong> for this laptop and paste it in
        that PowerShell window. It removes the old local agent and installs{" "}
        <strong>v{serverVersion}</strong> from the server.
      </li>
    </ol>
  );
}

export function AgentVersionUpdateBanner({
  summary,
  variant = "full",
}: AgentVersionUpdateBannerProps) {
  if (!summary.needsUpdate) return null;

  const versionLines = summary.devices
    .filter((d) => d.stale)
    .map((d) =>
      d.reportedVersion
        ? `${d.serialNumber}: v${d.reportedVersion}`
        : `${d.serialNumber}: version not reported yet`,
    );

  if (variant === "compact") {
    const zipName = formatAgentZipDownloadFilename(summary.serverVersion);
    return (
      <div className="rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange-muted)] px-3 py-2.5">
        <p className="text-sm font-medium text-[var(--pwc-orange)]">
          {AGENT_PRODUCT_NAME} update required — install{" "}
          <strong>v{summary.serverVersion}</strong>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Download <code>{zipName}</code>, extract, open PowerShell in that folder, then run your
          reinstall command from{" "}
          <Link href="/settings#install" className="text-accent hover:underline">
            Settings
          </Link>{" "}
          (uninstalls the old agent and installs the latest).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange)]/10 px-4 py-4">
      <p className="font-medium text-[var(--pwc-orange)]">
        Install agent <strong>v{summary.serverVersion}</strong> on your laptop
      </p>
      <p className="mt-1 text-sm text-muted">
        The server expects agent <strong>v{summary.serverVersion}</strong>. Use the zip download and
        reinstall command below — do not rely on background auto-update. The reinstall command
        clears the previous install and sets up the current version.
      </p>
      {versionLines.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-muted">
          {versionLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <AgentZipReinstallSteps serverVersion={summary.serverVersion} />
      <Link href="/settings#install" className="btn-primary mt-3 inline-block px-4 py-2 text-sm">
        Open Settings — copy reinstall command
      </Link>
    </div>
  );
}
