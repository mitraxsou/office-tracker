"use client";

import { useMemo, useState } from "react";
import {
  AGENT_INSTALL_DIR,
  AGENT_PRODUCT_NAME,
  AGENT_TASK_NAME,
  AGENT_STARTUP_SHORTCUT,
  AGENT_ZIP_STEM,
  buildUninstallCommand,
  defaultInstallScriptDir,
} from "@/lib/agent-branding";
import { copyToClipboard } from "@/lib/clipboard";
import type { InstallTokenForUser } from "@/lib/install-token-types";
import { InstallTokenCommands } from "@/components/InstallTokenCommands";

type AgentSetupPanelProps = {
  appUrl: string;
  installTokens?: InstallTokenForUser[];
  legacyBoundCount?: number;
  localDevAgentPath?: string | null;
  adminAccess?: boolean;
};

export function AgentSetupPanel({
  appUrl,
  installTokens = [],
  legacyBoundCount = 0,
  localDevAgentPath,
  adminAccess = false,
}: AgentSetupPanelProps) {
  const [copiedUninstall, setCopiedUninstall] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const scriptDir = defaultInstallScriptDir(isLocalDev ? localDevAgentPath : null);
  const startupPath = `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${AGENT_STARTUP_SHORTCUT}`;

  const uninstallCommand = useMemo(
    () => buildUninstallCommand(isLocalDev ? scriptDir : undefined),
    [isLocalDev, scriptDir],
  );

  return (
    <div id="install" className="scroll-mt-header space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install or update {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          Use <strong>PowerShell</strong> (not Command Prompt). Copy the setup command for your
          laptop below, paste it in any PowerShell window, and press Enter. The agent downloads
          from this server. No admin rights and no zip download required.
        </p>

        <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Copy the setup command</span>
            <p className="mt-1 text-muted">
              Pick your laptop card below and click <strong>Copy setup command</strong>. Works for
              first-time install and for updating an existing install.
            </p>
            <div className="mt-3">
              <InstallTokenCommands
                installTokens={installTokens}
                legacyBoundCount={legacyBoundCount}
              />
            </div>
          </li>
          <li>
            <span className="font-medium">Paste and run in PowerShell</span>
            <p className="mt-1 text-muted">
              Open PowerShell, paste the command (right-click or Ctrl+V), and press Enter. Install
              writes to <code>{AGENT_INSTALL_DIR}</code> and registers task{" "}
              <code>{AGENT_TASK_NAME}</code>.
            </p>
          </li>
          <li>
            <span className="font-medium">
              {adminAccess ? "Check agent status below" : "Confirm on your dashboard"}
            </span>
            <p className="mt-1 text-muted">
              {adminAccess ? (
                <>
                  Within 2 to 4 minutes, <strong>Agent status</strong> should show connected and your
                  laptop serial under Registered laptops. If not, confirm you used the correct token
                  and production URL.
                </>
              ) : (
                <>
                  Within 2 to 4 minutes, office hours on your <a href="/dashboard">dashboard</a>{" "}
                  should start updating. If not, confirm you used the correct token and production
                  URL, or see <a href="/help#troubleshooting">troubleshooting</a>.
                </>
              )}
            </p>
          </li>
        </ol>

        <details className="rounded-lg border border-[var(--border)] p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted">
            Advanced: install from zip ({AGENT_ZIP_STEM}.zip)
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-muted">
            <li>
              Download <code>{AGENT_ZIP_STEM}.zip</code> from the laptop card Advanced section or{" "}
              <a href="/api/agent/download" className="text-accent hover:underline">
                here
              </a>
              .
            </li>
            <li>Extract to Downloads and open PowerShell in the folder that contains install.ps1.</li>
            <li>Use the zip-based install or update commands in the Advanced section of your laptop card.</li>
          </ol>
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

      <section className="card p-6">
        <h2 className="mb-2 text-lg font-medium">Uninstall {AGENT_PRODUCT_NAME}</h2>
        <p className="mb-4 text-sm text-muted">
          For a clean reinstall, run uninstall from the agent install folder in PowerShell, or use
          the zip folder if you still have it extracted. No admin required.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
          {uninstallCommand}
        </pre>
        <button
          type="button"
          onClick={async () => {
            setCopyError(null);
            const ok = await copyToClipboard(uninstallCommand);
            if (ok) {
              setCopiedUninstall(true);
              setTimeout(() => setCopiedUninstall(false), 2000);
            } else {
              setCopyError("Could not copy. Select the command above and press Ctrl+C.");
            }
          }}
          className="btn-secondary mt-3 px-4 py-2 text-sm"
        >
          {copiedUninstall ? "Copied!" : "Copy uninstall command"}
        </button>
      </section>

      {copyError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{copyError}</p>
      )}
    </div>
  );
}
