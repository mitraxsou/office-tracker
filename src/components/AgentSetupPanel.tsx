"use client";

import { useEffect, useState } from "react";
import {
  AGENT_INSTALL_DIR,
  AGENT_PRODUCT_NAME,
  AGENT_STARTUP_SHORTCUT,
  AGENT_TASK_NAME,
  AGENT_DOWNLOAD_FOLDER,
  buildUninstallCommand,
} from "@/lib/agent-branding";

type AgentSetupPanelProps = {
  appUrl: string;
  initialPlainToken?: string | null;
  localDevAgentPath?: string | null;
};

export function AgentSetupPanel({
  appUrl,
  initialPlainToken,
  localDevAgentPath,
}: AgentSetupPanelProps) {
  const [command, setCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState<"install" | "uninstall" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const startupPath = `%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${AGENT_STARTUP_SHORTCUT}`;
  const uninstallDir = localDevAgentPath && isLocalDev ? localDevAgentPath : AGENT_DOWNLOAD_FOLDER;
  const uninstallCommand = buildUninstallCommand(uninstallDir);

  useEffect(() => {
    if (initialPlainToken && localDevAgentPath && isLocalDev) {
      setCommand(
        `powershell -ExecutionPolicy Bypass -File "${localDevAgentPath}\\install.ps1" -ApiUrl "${appUrl}" -Token "${initialPlainToken}"`
      );
    }
  }, [initialPlainToken, localDevAgentPath, isLocalDev, appUrl]);

  async function fetchInstallCommand() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/settings/install-command", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError("Failed to prepare install command");
      return;
    }
    const data = await res.json();
    setCommand(data.command);
    return data.command as string;
  }

  async function copyInstall() {
    const cmd = command ?? (await fetchInstallCommand());
    if (!cmd) return;
    await navigator.clipboard.writeText(cmd);
    setCopied("install");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyUninstall() {
    await navigator.clipboard.writeText(uninstallCommand);
    setCopied("uninstall");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="card border-[var(--pwc-orange)] p-6">
        <h2 className="mb-2 text-lg font-medium text-[var(--pwc-orange)]">
          Install {AGENT_PRODUCT_NAME}
        </h2>
        <p className="mb-4 text-sm text-muted">
          Download the zip, extract it, copy the install command, and run it in{" "}
          <strong>PowerShell</strong>.
        </p>

        <div className="flex flex-wrap gap-3">
          <a href="/api/agent/download" className="btn-secondary px-4 py-2 text-sm">
            Download agent (.zip)
          </a>
          <button
            type="button"
            onClick={copyInstall}
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "Preparing..." : copied === "install" ? "Copied!" : "Copy install command"}
          </button>
        </div>

        {command && (
          <pre className="mt-4 overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
            {command}
          </pre>
        )}

        <p className="mt-3 text-xs text-muted">
          Extract to <code>{AGENT_DOWNLOAD_FOLDER}</code>, then run the command. API URL:{" "}
          <code>{appUrl}</code> (from deployment env).
          {initialPlainToken && isLocalDev && localDevAgentPath && (
            <> Local dev path available for testing.</>
          )}
        </p>
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
          onClick={copyUninstall}
          className="btn-secondary mt-3 px-4 py-2 text-sm"
        >
          {copied === "uninstall" ? "Copied!" : "Copy uninstall command"}
        </button>
        <p className="mt-2 text-xs text-muted">Run in PowerShell. No admin required.</p>
      </section>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
