"use client";

import { useMemo, useState } from "react";
import {
  AGENT_EXTRACT_FOLDER,
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
};

export function AgentSetupPanel({
  appUrl,
  installTokens = [],
  legacyBoundCount = 0,
  localDevAgentPath,
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
    <div id="install" className="scroll-mt-6 space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install or reinstall {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          Use this section to set up the agent or fix a stale install. No admin required. Use{" "}
          <strong>PowerShell</strong> (not Command Prompt). Steps 1 to 3 are the same for both
          paths. After that, follow either <strong>Install (first time)</strong> or{" "}
          <strong>Update (already installed)</strong>, not both.
        </p>

        <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Download the agent zip</span>
            <p className="mt-1 text-muted">
              Save <code>{AGENT_ZIP_STEM}.zip</code> to Downloads. On PwC laptops that is often{" "}
              <code>OneDrive - PwC\Downloads</code>, not <code>%USERPROFILE%\Downloads</code>.
            </p>
            <a href="/api/agent/download" className="btn-primary mt-2 inline-block px-4 py-2 text-sm">
              Download agent (.zip)
            </a>
          </li>
          <li>
            <span className="font-medium">Extract the zip</span>
            <p className="mt-1 text-muted">
              Right-click the zip, choose <strong>Extract All</strong>, and extract to Downloads.
              The zip is named <code>{AGENT_ZIP_STEM}.zip</code>, so Extract All may create a nested
              folder such as <code>{`${AGENT_ZIP_STEM}\\${AGENT_EXTRACT_FOLDER}`}</code>. Open the inner
              folder until you see <code>install.ps1</code> and <code>update.ps1</code>.
            </p>
          </li>
          <li>
            <span className="font-medium">Open PowerShell in that folder</span>
            <p className="mt-1 text-muted">
              In the extracted folder, Shift + right-click empty space and choose{" "}
              <strong>Open PowerShell window here</strong> (or Terminal). Run <code>dir</code>; it
              must list <code>install.ps1</code>. The copy-paste commands use{" "}
              <code>.\install.ps1</code> and <code>.\update.ps1</code>, so they only work from this
              folder.
            </p>
            <p className="mt-1 text-xs text-muted">
              If this window is not already in that folder, <code>cd</code> into it first. Example
              nested path:{" "}
              <code>{`cd "$env:USERPROFILE\\OneDrive - PwC\\Downloads\\${AGENT_ZIP_STEM}\\${AGENT_EXTRACT_FOLDER}"`}</code>
            </p>
          </li>
          <li>
            <span className="font-medium">Pick your laptop, then choose Install or Update</span>
            <p className="mt-1 text-muted">
              Each laptop card below has two separate sections. Use{" "}
              <strong>Install (first time)</strong> if the agent has never run on this laptop. Use{" "}
              <strong>Update (already installed)</strong> to refresh an agent that is already there.
              You only need one of them.
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
              Paste the one command you copied into the PowerShell window you opened in this folder
              (right-click or Ctrl+V) and press Enter. It must run from the folder that contains the
              scripts. Install writes to <code>{AGENT_INSTALL_DIR}</code> and registers task{" "}
              <code>{AGENT_TASK_NAME}</code>.
            </p>
          </li>
          <li>
            <span className="font-medium">Check agent status above</span>
            <p className="mt-1 text-muted">
              Within 2 to 4 minutes, <strong>Agent status</strong> should show connected and your
              laptop serial under Registered laptops. If not, confirm you used the correct token
              and production URL.
            </p>
          </li>
        </ol>
        <p className="text-xs text-muted">API URL: {appUrl}</p>
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
          For a clean reinstall, run uninstall first from the extracted agent folder in PowerShell.
          No admin required.
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
