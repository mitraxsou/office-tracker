"use client";

import { useState } from "react";

type InstallCommandCopyProps = {
  appUrl: string;
  token?: string | null;
  localAgentPath?: string;
  githubAgentPath?: string;
};

function buildInstallCommand(appUrl: string, token: string, installScriptPath: string) {
  return `powershell -ExecutionPolicy Bypass -File "${installScriptPath}\\install.ps1" -ApiUrl "${appUrl}" -Token "${token}"`;
}

export function InstallCommandCopy({
  appUrl,
  token,
  localAgentPath,
  githubAgentPath = "%USERPROFILE%\\OfficeTracker-repo\\agent",
}: InstallCommandCopyProps) {
  const [copied, setCopied] = useState<"local" | "github" | null>(null);
  const isLocalDev = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const tokenValue = token?.trim() || "PASTE-YOUR-TOKEN-FROM-ABOVE";
  const localPath =
    localAgentPath ||
    "C:\\Users\\smandal089\\OneDrive - PwC\\Documents\\Cursor\\OfficeTracker\\agent";

  const localCommand = buildInstallCommand(appUrl, tokenValue, localPath);
  const githubCommand = buildInstallCommand(appUrl, tokenValue, githubAgentPath);

  async function copy(which: "local" | "github") {
    const text = which === "local" ? localCommand : githubCommand;
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <strong>Run in PowerShell</strong> (not cmd.exe). Paste the command below. Full paths
        included; no <code>cd</code> needed.
      </div>

      <p className="text-sm font-medium text-[var(--pwc-orange)]">
        Copy your token above, then copy and run an install command below.
      </p>

      {isLocalDev && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Local dev (this project folder)</p>
          <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
            {localCommand}
          </pre>
          <button type="button" onClick={() => copy("local")} className="btn-primary px-4 py-2 text-sm">
            {copied === "local" ? "Copied!" : "Copy local dev install command"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">
          {isLocalDev ? "After GitHub clone (colleagues)" : "Install from GitHub clone"}
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
          {githubCommand}
        </pre>
        <button type="button" onClick={() => copy("github")} className="btn-secondary px-4 py-2 text-sm">
          {copied === "github" ? "Copied!" : "Copy GitHub clone install command"}
        </button>
      </div>

      {!token && (
        <p className="text-xs text-muted">
          Replace PASTE-YOUR-TOKEN-FROM-ABOVE with your token from above. No admin / UAC required.
        </p>
      )}
    </div>
  );
}
