"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

export function UninstallCommandCopy({ uninstallPath }: { uninstallPath: string }) {
  const [copied, setCopied] = useState(false);
  const command = `powershell -ExecutionPolicy Bypass -File "${uninstallPath}\\uninstall.ps1"`;

  async function copy() {
    const ok = await copyToClipboard(command);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Removes the scheduled task, Startup shortcut, and local agent files. Your visit history
        stays in the web app.
      </p>
      <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs whitespace-pre-wrap">
        {command}
      </pre>
      <button type="button" onClick={copy} className="btn-secondary px-4 py-2 text-sm">
        {copied ? "Copied!" : "Copy uninstall command"}
      </button>
      <p className="text-xs text-muted">Run in PowerShell (not cmd.exe). No admin required.</p>
    </div>
  );
}
