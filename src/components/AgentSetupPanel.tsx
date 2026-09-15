"use client";



import { useMemo, useState } from "react";
import {
  AGENT_INSTALL_DIR,
  AGENT_INSTALL_FOLDER,
  AGENT_PRODUCT_NAME,
  AGENT_TASK_NAME,
  AGENT_STARTUP_SHORTCUT,
  AGENT_ZIP_STEM,
  buildUninstallCommand,
  defaultInstallScriptDir,
} from "@/lib/agent-branding";
import { copyToClipboard } from "@/lib/clipboard";
import type { InstallTokenForUser } from "@/lib/install-token-types";
import {
  InstallTokenCommands,
  needsRefreshInstallCommands,
} from "@/components/InstallTokenCommands";



type InstallScenario = "first" | "update" | "clean";



type AgentSetupPanelProps = {
  appUrl: string;
  installTokens?: InstallTokenForUser[];
  legacyBoundCount?: number;
  localDevAgentPath?: string | null;
  adminAccess?: boolean;
};



const SCENARIO_OPTIONS: {
  id: InstallScenario;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "first",
    title: "First time on this laptop",
    subtitle: "New user or no agent installed yet",
  },
  {
    id: "update",
    title: "Update agent",
    subtitle: "Agent already working; refresh scripts",
  },
  {
    id: "clean",
    title: "Clean reinstall",
    subtitle: "Fix problems or a corrupted install",
  },
];



export function AgentSetupPanel({
  appUrl,
  installTokens = [],
  legacyBoundCount = 0,
  localDevAgentPath,
  adminAccess = false,
}: AgentSetupPanelProps) {
  const [scenario, setScenario] = useState<InstallScenario>("first");
  const [copiedUninstall, setCopiedUninstall] = useState(false);
  const [copiedReinstallSetup, setCopiedReinstallSetup] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);



  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const scriptDir = defaultInstallScriptDir(isLocalDev ? localDevAgentPath : null);
  const startupPath = `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${AGENT_STARTUP_SHORTCUT}`;
  const showRefreshCallout = needsRefreshInstallCommands(installTokens, legacyBoundCount);
  const hasTokens = installTokens.length > 0;



  const zipUninstallCommand = useMemo(
    () => buildUninstallCommand(isLocalDev ? scriptDir : undefined),
    [isLocalDev, scriptDir],
  );



  const tokenForReinstall = useMemo(
    () => installTokens.find((t) => t.plainToken || t.usesLocalConfig) ?? installTokens[0] ?? null,
    [installTokens],
  );



  function scrollToRefreshCommands() {
    document.getElementById("refresh-install-commands")?.scrollIntoView({ behavior: "smooth" });
  }



  function scrollToCleanReinstall() {
    document.getElementById("clean-reinstall")?.scrollIntoView({ behavior: "smooth" });
  }



  return (
    <div id="install" className="scroll-mt-header space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install or update {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          Use <strong>PowerShell</strong> (not Command Prompt). Pick the path that matches your
          situation, then follow the steps.
        </p>



        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {SCENARIO_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScenario(opt.id)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                scenario === opt.id
                  ? "border-[var(--pwc-orange)] bg-[var(--pwc-orange)]/10"
                  : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--pwc-orange)]/40"
              }`}
            >
              <span className="font-medium text-foreground">{opt.title}</span>
              <p className="mt-1 text-xs text-muted">{opt.subtitle}</p>
            </button>
          ))}
        </div>



        {showRefreshCallout && (
          <div className="mb-6 rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange)]/10 p-4 text-sm">
            <p className="font-medium text-[var(--pwc-orange)]">Your install commands need a refresh</p>
            <p className="mt-1 text-xs text-muted">
              Commands on this page may be missing the embedded token. Use{" "}
              <strong>Refresh install commands</strong> on your laptop card before copying setup
              again.
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



        {scenario === "first" && (
          <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
            <li>
              <span className="font-medium">
                {hasTokens ? "Copy the setup command" : "Generate token, then copy setup"}
              </span>
              <p className="mt-1 text-muted">
                {hasTokens ? (
                  <>
                    Pick your laptop card below and click <strong>Copy setup command</strong>.
                  </>
                ) : (
                  <>
                    Click <strong>Generate setup command</strong>, then{" "}
                    <strong>Copy setup command</strong> on the laptop card that appears.
                  </>
                )}
              </p>
            </li>
            <li>
              <span className="font-medium">Paste and run in PowerShell</span>
              <p className="mt-1 text-muted">
                Install writes to <code>{AGENT_INSTALL_DIR}</code> and registers task{" "}
                <code>{AGENT_TASK_NAME}</code>. No admin rights required.
              </p>
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
                    <a href="/dashboard">dashboard</a> should start updating.
                  </>
                )}
              </p>
            </li>
          </ol>
        )}



        {scenario === "update" && (
          <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm">
            <li>
              <span className="font-medium">Copy the setup command</span>
              <p className="mt-1 text-muted">
                On your laptop card below, click <strong>Copy setup command</strong>. The same
                command installs or updates the agent from this server.
              </p>
            </li>
            <li>
              <span className="font-medium">Paste and run in PowerShell</span>
              <p className="mt-1 text-muted">
                Safe to re-run on an existing install. Scripts refresh under{" "}
                <code>{AGENT_INSTALL_DIR}</code>.
              </p>
            </li>
            <li>
              <span className="font-medium">Confirm heartbeat</span>
              <p className="mt-1 text-muted">
                Within a few minutes, agent status or your dashboard should show a recent sync. If
                update fails, try the{" "}
                <button
                  type="button"
                  onClick={() => setScenario("clean")}
                  className="text-accent hover:underline"
                >
                  clean reinstall
                </button>{" "}
                path.
              </p>
            </li>
          </ol>
        )}



        {scenario === "clean" && (
          <div className="mb-6 space-y-3 text-sm">
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <span className="font-medium">Copy and run the uninstall command</span>
                <p className="mt-1 text-muted">
                  In the <strong>Clean reinstall</strong> section below, copy{" "}
                  <strong>Copy uninstall command</strong>, run it in PowerShell, and wait until it
                  finishes.
                </p>
              </li>
              <li>
                <span className="font-medium">Verify removal</span>
                <p className="mt-1 text-muted">
                  Confirm the folder and scheduled task are gone before reinstalling (checklist in
                  that section).
                </p>
              </li>
              <li>
                <span className="font-medium">Copy setup command and install again</span>
                <p className="mt-1 text-muted">
                  Use <strong>Copy setup command</strong> in the clean reinstall section or on your
                  laptop card.
                </p>
              </li>
            </ol>
            <button
              type="button"
              onClick={scrollToCleanReinstall}
              className="btn-primary px-4 py-2 text-sm"
            >
              Go to clean reinstall steps
            </button>
          </div>
        )}



        {(scenario === "first" || scenario === "update") && (
          <div className="mb-6">
            <InstallTokenCommands
              installTokens={installTokens}
              legacyBoundCount={legacyBoundCount}
            />
          </div>
        )}



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



      <section id="clean-reinstall" className="card scroll-mt-header p-6">
        <h2 className="mb-2 text-lg font-medium">Clean reinstall (laptop issues)</h2>
        <p className="mb-4 text-sm text-muted">
          If install or update fails, remove the agent completely then install again. Use{" "}
          <strong>PowerShell</strong>. Run step 1, verify step 2, then run step 3. No admin required.
        </p>
        {tokenForReinstall ? (
          <ol className="list-decimal space-y-4 pl-5 text-sm">
            <li>
              <span className="font-medium">Uninstall</span>
              <pre className="mt-2 overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
                {tokenForReinstall.bootstrapUninstallCommand}
              </pre>
              <button
                type="button"
                onClick={async () => {
                  setCopyError(null);
                  const ok = await copyToClipboard(tokenForReinstall.bootstrapUninstallCommand);
                  if (ok) {
                    setCopiedUninstall(true);
                    setTimeout(() => setCopiedUninstall(false), 2000);
                  } else {
                    setCopyError("Could not copy. Select the command above and press Ctrl+C.");
                  }
                }}
                className="btn-secondary mt-2 px-4 py-2 text-sm"
              >
                {copiedUninstall ? "Copied!" : "Copy uninstall command"}
              </button>
            </li>
            <li>
              <span className="font-medium">Verify removal (before reinstall)</span>
              <p className="mt-1 text-muted">
                In PowerShell, both checks should show the agent is gone:
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-xs text-muted">
                <li>
                  <code>Test-Path &quot;$env:LOCALAPPDATA\{AGENT_INSTALL_FOLDER}&quot;</code>{" "}
                  returns <strong>False</strong>
                </li>
                <li>
                  <code>Get-ScheduledTask -TaskName &apos;{AGENT_TASK_NAME}&apos;</code> fails or
                  reports the task was removed
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted">
                If the folder or task still exists, run the uninstall command again and wait until
                it completes.
              </p>
            </li>
            <li>
              <span className="font-medium">Reinstall (setup)</span>
              <p className="mt-1 text-muted">
                Same command as <strong>Copy setup command</strong> on your laptop card in the
                install section above.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
                {tokenForReinstall.setupCommand}
              </pre>
              <button
                type="button"
                onClick={async () => {
                  setCopyError(null);
                  const ok = await copyToClipboard(tokenForReinstall.setupCommand);
                  if (ok) {
                    setCopiedReinstallSetup(true);
                    setTimeout(() => setCopiedReinstallSetup(false), 2000);
                  } else {
                    setCopyError("Could not copy. Select the command above and press Ctrl+C.");
                  }
                }}
                className="btn-secondary mt-2 px-4 py-2 text-sm"
              >
                {copiedReinstallSetup ? "Copied!" : "Copy setup command"}
              </button>
            </li>
          </ol>
        ) : (
          <p className="text-sm text-muted">
            In the install section above, choose <strong>First time on this laptop</strong> and{" "}
            <strong>Generate setup command</strong>, or use{" "}
            <strong>Refresh install commands</strong> if you already had a token.
          </p>
        )}
        <details className="mt-4 rounded-lg border border-[var(--border)] p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted">
            If you still have the zip folder extracted
          </summary>
          <p className="mt-2 text-xs text-muted">
            Open PowerShell in the folder that contains uninstall.ps1, then run:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-[var(--background)] p-3 text-xs whitespace-pre-wrap">
            {zipUninstallCommand}
          </pre>
        </details>
      </section>



      {copyError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{copyError}</p>
      )}
    </div>
  );
}

