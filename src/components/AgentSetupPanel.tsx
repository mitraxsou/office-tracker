"use client";

import { useMemo, useState } from "react";
import {
  AGENT_DOWNLOAD_FOLDER,
  AGENT_EXTRACT_PATH_PS,
  AGENT_INSTALL_DIR,
  AGENT_PRODUCT_NAME,
  AGENT_TASK_NAME,
  AGENT_STARTUP_SHORTCUT,
  formatAgentZipDownloadFilename,
  buildUninstallCommand,
  defaultInstallScriptDir,
} from "@/lib/agent-branding";
import type { InstallTokenForUser } from "@/lib/install-token-types";
import {
  InstallTokenCommands,
  needsRefreshInstallCommands,
} from "@/components/InstallTokenCommands";
import { AgentVersionUpdateBanner } from "@/components/AgentVersionUpdateBanner";
import type { UserAgentVersionSummary } from "@/lib/agent-update";
import type { AgentDownloadVersionOption } from "@/lib/agent-download";

type AgentSetupPanelProps = {
  appUrl: string;
  installTokens?: InstallTokenForUser[];
  legacyBoundCount?: number;
  localDevAgentPath?: string | null;
  adminAccess?: boolean;
  agentVersionSummary?: UserAgentVersionSummary | null;
  downloadVersionOptions?: AgentDownloadVersionOption[];
};

export function AgentSetupPanel({
  appUrl,
  installTokens = [],
  legacyBoundCount = 0,
  localDevAgentPath,
  adminAccess = false,
  agentVersionSummary = null,
  downloadVersionOptions = [],
}: AgentSetupPanelProps) {
  const recommendedVersion =
    downloadVersionOptions.find((option) => option.recommended)?.version ??
    agentVersionSummary?.serverVersion ??
    null;
  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    recommendedVersion,
  );

  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const scriptDir = defaultInstallScriptDir(isLocalDev ? localDevAgentPath : null);
  const startupPath = `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${AGENT_STARTUP_SHORTCUT}`;
  const showRefreshCallout = needsRefreshInstallCommands(installTokens, legacyBoundCount);
  const activeVersion = selectedVersion || recommendedVersion;
  const zipDownloadName = activeVersion
    ? formatAgentZipDownloadFilename(activeVersion)
    : "PwCOfficePulse-agent-v….zip";
  const downloadHref = activeVersion
    ? `/api/agent/download?version=${encodeURIComponent(activeVersion)}`
    : "/api/agent/download";
  const showVersionPicker = downloadVersionOptions.length > 1;

  const zipUninstallCommand = useMemo(
    () => buildUninstallCommand(isLocalDev ? scriptDir : undefined),
    [isLocalDev, scriptDir],
  );

  function scrollToRefreshCommands() {
    document.getElementById("refresh-install-commands")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div id="install" className="scroll-mt-header space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install or reinstall {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          One flow for every laptop: download the agent zip, extract it, open PowerShell in that
          folder, and run your <strong>reinstall command</strong>. It installs the{" "}
          <strong>version recommended for your account</strong> - first install, routine update, or
          fixing a corrupted agent. Use <strong>PowerShell</strong>, not Command Prompt. No admin
          required.
        </p>

        {agentVersionSummary?.needsUpdate && (
          <div className="mb-6">
            <AgentVersionUpdateBanner summary={agentVersionSummary} variant="full" />
          </div>
        )}

        {showRefreshCallout && (
          <div className="mb-6 rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange)]/10 p-4 text-sm">
            <p className="font-medium text-[var(--pwc-orange)]">Your reinstall command needs a refresh</p>
            <p className="mt-1 text-xs text-muted">
              Use <strong>Refresh install commands</strong> on your laptop card so the copied command
              includes your token.
            </p>
            <button
              type="button"
              onClick={scrollToRefreshCommands}
              className="btn-secondary mt-3 px-3 py-1.5 text-xs"
            >
              Go to refresh install commands
            </button>
          </div>
        )}

        <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Download and extract the agent zip</span>
            <p className="mt-1 text-muted">
              Download <code>{zipDownloadName}</code>
              {activeVersion ? ` (agent v${activeVersion})` : ""} from your laptop card below or{" "}
              <a href={downloadHref} className="text-accent hover:underline">
                download here
              </a>
              . Extract so you have a folder with <code>setup.ps1</code> and <code>lib\</code>{" "}
              (often <code>{AGENT_DOWNLOAD_FOLDER}</code>; OneDrive Downloads may differ).
            </p>
            {showVersionPicker && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor="agent-download-version" className="text-xs text-muted">
                  Available builds
                </label>
                <select
                  id="agent-download-version"
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                  value={activeVersion ?? ""}
                  onChange={(event) => setSelectedVersion(event.target.value)}
                >
                  {downloadVersionOptions.map((option) => (
                    <option key={option.version} value={option.version}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <a href={downloadHref} className="btn-secondary px-3 py-1.5 text-xs">
                  Download selected
                </a>
              </div>
            )}
          </li>
          <li>
            <span className="font-medium">Open PowerShell in that folder</span>
            <p className="mt-1 text-muted">
              In File Explorer, open the extracted folder, then <strong>Open PowerShell window
              here</strong> (or <code>cd {AGENT_EXTRACT_PATH_PS}</code> if that matches your path).
            </p>
          </li>
          <li>
            <span className="font-medium">Copy and run the reinstall command</span>
            <p className="mt-1 text-muted">
              On your laptop card, click <strong>Copy reinstall command</strong>, paste in that
              PowerShell window, and press Enter. Safe to run again anytime.
            </p>
            <div className="mt-3">
              <InstallTokenCommands
                installTokens={installTokens}
                legacyBoundCount={legacyBoundCount}
                serverAgentVersion={recommendedVersion}
              />
            </div>
          </li>
          <li>
            <span className="font-medium">
              {adminAccess ? "Check agent status below" : "Confirm on your dashboard"}
            </span>
            <p className="mt-1 text-muted">
              {adminAccess ? (
                <>
                  Within 2 to 4 minutes, <strong>Agent status</strong> should show connected and
                  your laptop serial under Registered laptops.
                </>
              ) : (
                <>
                  Within 2 to 4 minutes, office hours on your{" "}
                  <a href="/dashboard">dashboard</a> should start updating, or see{" "}
                  <a href="/help#troubleshooting">troubleshooting</a>.
                </>
              )}
            </p>
          </li>
        </ol>

        <details className="rounded-lg border border-[var(--border)] p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted">
            Optional: remove the agent first (zip uninstall.ps1)
          </summary>
          <p className="mt-2 text-xs text-muted">
            Only if you want a clean slate before reinstalling. Open PowerShell in the zip folder
            and run:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-[var(--background)] p-3 text-xs whitespace-pre-wrap">
            {zipUninstallCommand}
          </pre>
        </details>

        <p className="mt-4 text-xs text-muted">API URL: {appUrl}</p>
      </section>

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Where the agent lives on your laptop</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted">Install folder</dt>
            <dd className="font-mono">{AGENT_INSTALL_DIR}</dd>
          </div>
          <div>
            <dt className="text-muted">Scheduled task</dt>
            <dd className="font-mono">{AGENT_TASK_NAME}</dd>
          </div>
          <div>
            <dt className="text-muted">Startup shortcut</dt>
            <dd className="font-mono break-all">{startupPath}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
