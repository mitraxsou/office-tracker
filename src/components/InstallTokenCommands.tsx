"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AGENT_INSTALL_DIR } from "@/lib/agent-branding";
import { copyToClipboard } from "@/lib/clipboard";
import type { InstallTokenForUser } from "@/lib/install-token-types";

type InstallTokenCommandsProps = {
  installTokens: InstallTokenForUser[];
  legacyBoundCount?: number;
  compact?: boolean;
};

export function InstallTokenCommands({
  installTokens,
  compact = false,
}: InstallTokenCommandsProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleGenerateInstallCommand() {
    if (
      !confirm(
        "This creates a new laptop token and invalidates any old token until you run the new install or update command. Continue?",
      )
    ) {
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    const res = await fetch("/api/settings/regenerate-token", { method: "POST" });
    setGenerating(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setGenerateError(body.error ?? "Could not generate install command");
      return;
    }
    router.refresh();
  }

  async function handleCopy(text: string, tokenId: string) {
    setCopyError(null);
    const ok = await copyToClipboard(text);
    if (!ok) {
      setCopyError("Could not copy. Select the command below and press Ctrl+C.");
      return;
    }
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (installTokens.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-muted">
        <p>No install token is ready yet. Generate one here to copy the install and update commands.</p>
        <button
          type="button"
          onClick={() => void handleGenerateInstallCommand()}
          disabled={generating}
          className="btn-primary mt-3 px-3 py-1.5 text-xs"
        >
          {generating ? "Generating..." : "Generate install command"}
        </button>
        {generateError && (
          <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {generateError}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {installTokens.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border p-3 text-sm ${
              t.status === "pending"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-[var(--border)] bg-[var(--background)]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.label ?? "Laptop token"}</span>
              <code className="text-xs text-muted">{t.prefix}</code>
              {t.status === "bound" && t.boundSerialNumber ? (
                <span className="rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
                  Bound to {t.boundSerialNumber}
                </span>
              ) : (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                  Waiting for first install
                </span>
              )}
            </div>
            {!compact && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-muted">
                  Issued {new Date(t.createdAt).toLocaleString("en-IN")}
                </p>
                {t.plainToken && (
                  <button
                    type="button"
                    onClick={() => handleCopy(t.plainToken!, `${t.id}-token`)}
                    className="btn-secondary px-3 py-1 text-xs"
                  >
                    {copiedId === `${t.id}-token` ? "Copied!" : "Copy token"}
                  </button>
                )}
              </div>
            )}
            {t.usesLocalConfig && (
              <p className="mt-2 text-xs text-muted">
                These commands reuse your existing token from{" "}
                <code>{AGENT_INSTALL_DIR}\config.json</code> on this laptop. No token change is
                required.
              </p>
            )}

            <div className="mt-3 rounded border border-[var(--border)] p-3">
              <p className="text-sm font-medium">Install (first time)</p>
              <p className="mt-1 text-xs text-muted">
                Download and extract the agent zip, open PowerShell in that folder, then paste this
                command. The folder must contain <code>install.ps1</code>.
              </p>
              <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background-elevated)] p-2 text-xs whitespace-pre-wrap">
                {t.installCommand}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(t.installCommand, t.id)}
                className="btn-primary mt-2 px-3 py-1 text-xs"
              >
                {copiedId === t.id ? "Copied!" : "Copy install command"}
              </button>
            </div>

            <div className="mt-3 rounded border border-[var(--border)] p-3">
              <p className="text-sm font-medium">Update (already installed)</p>
              <p className="mt-1 text-xs text-muted">
                Use this to refresh an agent that is already on this laptop. Run it from the same
                extract folder, which must contain <code>update.ps1</code>.
              </p>
              <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background-elevated)] p-2 text-xs whitespace-pre-wrap">
                {t.updateCommand}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(t.updateCommand, `${t.id}-update`)}
                className="btn-primary mt-2 px-3 py-1 text-xs"
              >
                {copiedId === `${t.id}-update` ? "Copied!" : "Copy update command"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {copyError && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{copyError}</p>
      )}
      {!compact && (
        <Link href="/help#troubleshooting" className="mt-3 inline-block text-xs text-accent hover:underline">
          Troubleshooting help
        </Link>
      )}
    </>
  );
}
