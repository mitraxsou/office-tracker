"use client";

import { useMemo, useState } from "react";
import {
  AGENT_DOWNLOAD_FOLDER,
  AGENT_EXTRACT_FOLDER,
  AGENT_INSTALL_DIR,
  AGENT_PRODUCT_NAME,
  AGENT_STARTUP_SHORTCUT,
  AGENT_TASK_NAME,
  buildInstallCommand,
  buildUninstallCommand,
  defaultInstallScriptDir,
} from "@/lib/agent-branding";
import { copyToClipboard } from "@/lib/clipboard";

type AgentSetupPanelProps = {
  appUrl: string;
  plainToken?: string | null;
  localDevAgentPath?: string | null;
};

export function AgentSetupPanel({
  appUrl,
  plainToken,
  localDevAgentPath,
}: AgentSetupPanelProps) {
  const [copied, setCopied] = useState<"install" | "uninstall" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const scriptDir = defaultInstallScriptDir(isLocalDev ? localDevAgentPath : null);
  const startupPath = `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${AGENT_STARTUP_SHORTCUT}`;

  const installCommand = useMemo(() => {
    if (!plainToken) return null;
    return buildInstallCommand(appUrl, plainToken, scriptDir);
  }, [appUrl, plainToken, scriptDir]);

  const uninstallCommand = buildUninstallCommand(scriptDir);

  async function handleCopy(text: string, which: "install" | "uninstall") {
    setCopyError(null);
    const ok = await copyToClipboard(text);
    if (!ok) {
      setCopyError("Could not copy to clipboard. Select the command below and press Ctrl+C.");
      return;
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          No admin required. Use <strong>PowerShell</strong> (not Command Prompt).
        </p>

        <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Download the agent zip</span>
            <p className="mt-1 text-muted">
              Click the button below. Save <code>PwCOfficePulse-agent.zip</code> to your Downloads
              folder.
            </p>
            <a href="/api/agent/download" className="btn-secondary mt-2 inline-block px-4 py-2 text-sm">
              Download agent (.zip)
            </a>
          </li>
          <li>
            <span className="font-medium">Extract the zip</span>
            <p className="mt-1 text-muted">
              Right-click the zip, choose <strong>Extract All</strong>, and extract to your{" "}
              <strong>Downloads</strong> folder. Windows creates a folder named{" "}
              <code>{AGENT_EXTRACT_FOLDER}</code> with <code>install.ps1</code> inside. You do not
              need to rename it.
            </p>
            <p className="mt-1 text-xs text-muted">
              Expected path: <code>{AGENT_DOWNLOAD_FOLDER}</code>
            </p>
          </li>
          <li>
            <span className="font-medium">Open PowerShell</span>
            <p className="mt-1 text-muted">
              Press <kbd className="rounded border px-1">Win</kbd> +{" "}
              <kbd className="rounded border px-1">X</kbd>, then choose{" "}
              <strong>Windows PowerShell</strong> or <strong>Terminal</strong>. Do not use cmd.exe.
            </p>
          </li>
          <li>
            <span className="font-medium">Copy the install command</span>
            <p className="mt-1 text-muted">
              Click the button below. It includes your token and the full path to{" "}
              <code>install.ps1</code>. You do not need to <code>cd</code> into the folder first.
            </p>
            {!plainToken && (
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Your agent token is not visible. Click <strong>Regenerate token</strong> in the
                section above, then copy the install command again.
              </p>
            )}
            <button
              type="button"
              onClick={() => installCommand && handleCopy(installCommand, "install")}
              disabled={!installCommand}
              className="btn-primary mt-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {copied === "install" ? "Copied!" : "Copy install command"}
            </button>
          </li>
          <li>
            <span className="font-medium">Paste and run in PowerShell</span>
            <p className="mt-1 text-muted">
              Right-click the PowerShell window to paste (or{" "}
              <kbd className="rounded border px-1">Ctrl</kbd> +{" "}
              <kbd className="rounded border px-1">V</kbd>), then press Enter. The agent installs
              to <code>{AGENT_INSTALL_DIR}</code> and registers a scheduled task.
            </p>
          </li>
          <li>
            <span className="font-medium">Verify on the dashboard</span>
            <p className="mt-1 text-muted">
              Open the{" "}
              <a href="/dashboard" className="text-[var(--pwc-orange)] hover:underline">
                dashboard
              </a>
              . Within a few minutes you should see heartbeats and your laptop listed under
              Registered laptops above.
            </p>
          </li>
        </ol>

        {installCommand && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Install command preview</p>
            <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
              {installCommand}
            </pre>
          </div>
        )}

        {isLocalDev && localDevAgentPath && (
          <p className="mt-3 text-xs text-muted">
            Local dev: command points to <code>{localDevAgentPath}</code>.
          </p>
        )}
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
            <dd className="font-mono">
              {AGENT_TASK_NAME} <span className="text-muted">({AGENT_PRODUCT_NAME})</span>
            </dd>
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
          Removes the scheduled task, Startup shortcut, and local agent files. Your visit history
          stays in the web app.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
          {uninstallCommand}
        </pre>
        <button
          type="button"
          onClick={() => handleCopy(uninstallCommand, "uninstall")}
          className="btn-secondary mt-3 px-4 py-2 text-sm"
        >
          {copied === "uninstall" ? "Copied!" : "Copy uninstall command"}
        </button>
        <p className="mt-2 text-xs text-muted">Run in PowerShell. No admin required.</p>
      </section>

      {copyError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{copyError}</p>
      )}
    </div>
  );
}
