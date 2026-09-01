"use client";

import { useMemo, useState } from "react";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_INSTALL_DIR,
  AGENT_PRODUCT_NAME,
  AGENT_TASK_NAME,
  AGENT_STARTUP_SHORTCUT,
  buildUninstallCommand,
  defaultInstallScriptDir,
} from "@/lib/agent-branding";
import { copyToClipboard } from "@/lib/clipboard";
import type { InstallTokenForUser } from "@/lib/install-token-types";

type AgentSetupPanelProps = {
  appUrl: string;
  installTokens?: InstallTokenForUser[];
  localDevAgentPath?: string | null;
};

export function AgentSetupPanel({
  appUrl,
  installTokens = [],
  localDevAgentPath,
}: AgentSetupPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUninstall, setCopiedUninstall] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const scriptDir = defaultInstallScriptDir(isLocalDev ? localDevAgentPath : null);
  const startupPath = `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${AGENT_STARTUP_SHORTCUT}`;

  const uninstallCommand = useMemo(
    () => buildUninstallCommand(isLocalDev ? scriptDir : undefined),
    [isLocalDev, scriptDir],
  );

  async function handleCopy(text: string, tokenId: string) {
    setCopyError(null);
    const ok = await copyToClipboard(text);
    if (!ok) {
      setCopyError("Could not copy to clipboard. Select the command below and press Ctrl+C.");
      return;
    }
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          No admin required. Use <strong>PowerShell</strong> (not Command Prompt). Re-running
          install is safe; it refreshes an existing install silently.
        </p>

        <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Download the agent zip</span>
            <p className="mt-1 text-muted">
              Save <code>PwCOfficePulse-agent.zip</code> to your Downloads folder.
            </p>
            <a href="/api/agent/download" className="btn-secondary mt-2 inline-block px-4 py-2 text-sm">
              Download agent (.zip)
            </a>
          </li>
          <li>
            <span className="font-medium">Extract the zip</span>
            <p className="mt-1 text-muted">
              Right-click the zip, choose <strong>Extract All</strong>, and extract to{" "}
              <strong>Downloads</strong>. Windows creates <code>{AGENT_EXTRACT_FOLDER}</code> with{" "}
              <code>install.ps1</code> inside. No rename needed.
            </p>
          </li>
          <li>
            <span className="font-medium">Open PowerShell in that folder</span>
            <p className="mt-1 text-muted">
              In Downloads, open the <code>{AGENT_EXTRACT_FOLDER}</code> folder. Shift + right-click
              empty space, choose <strong>Open PowerShell window here</strong> (or Terminal). You
              should see <code>install.ps1</code> in that window&apos;s folder.
            </p>
            <p className="mt-1 text-xs text-muted">
              Or run:{" "}
              <code>{`cd $env:USERPROFILE\\Downloads\\${AGENT_EXTRACT_FOLDER}`}</code>
            </p>
          </li>
          <li>
            <span className="font-medium">Copy the install command for your laptop</span>
            {installTokens.length === 0 ? (
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                No install tokens available. Ask your admin to issue one from Admin → Users &
                tokens. It will appear under <strong>Laptop install tokens</strong> above.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {installTokens.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {t.label ?? "Laptop token"}
                      </span>
                      <code className="text-muted">{t.prefix}</code>
                      {t.status === "bound" && t.boundSerialNumber ? (
                        <span className="rounded bg-green-500/15 px-2 py-0.5 text-green-400">
                          Bound to {t.boundSerialNumber}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">
                          Waiting for first install
                        </span>
                      )}
                    </div>
                    <pre className="overflow-x-auto rounded border p-2 text-xs whitespace-pre-wrap">
                      {t.installCommand}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handleCopy(t.installCommand, t.id)}
                      className="btn-primary mt-2 px-3 py-1.5 text-xs"
                    >
                      {copiedId === t.id ? "Copied!" : "Copy install command"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </li>
          <li>
            <span className="font-medium">Paste and run in PowerShell</span>
            <p className="mt-1 text-muted">
              Paste the command (right-click or Ctrl+V) and press Enter. Installs to{" "}
              <code>{AGENT_INSTALL_DIR}</code> and registers task <code>{AGENT_TASK_NAME}</code>.
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
          Run from the extracted agent folder in PowerShell. No admin required.
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
          {uninstallCommand}
        </pre>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(uninstallCommand);
            if (ok) {
              setCopiedUninstall(true);
              setTimeout(() => setCopiedUninstall(false), 2000);
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
