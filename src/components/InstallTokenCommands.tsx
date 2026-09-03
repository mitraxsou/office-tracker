"use client";

import Link from "next/link";
import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import type { InstallTokenForUser } from "@/lib/install-token-types";

type InstallTokenCommandsProps = {
  installTokens: InstallTokenForUser[];
  legacyBoundCount?: number;
  compact?: boolean;
};

export function InstallTokenCommands({
  installTokens,
  legacyBoundCount = 0,
  compact = false,
}: InstallTokenCommandsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

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

  if (installTokens.length === 0 && legacyBoundCount > 0) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-muted">
        <p>
          Your laptop token was issued before reinstall commands were saved. Ask your admin to
          reissue a token from Admin → Users &amp; tokens, then run the new install command here.
        </p>
        <Link href="/help#troubleshooting" className="mt-2 inline-block text-accent hover:underline">
          Troubleshooting help
        </Link>
      </div>
    );
  }

  if (installTokens.length === 0) {
    return (
      <p className="text-sm text-muted">
        No install tokens yet. Ask your admin to issue one from Admin → Users &amp; tokens.
      </p>
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
              <p className="mt-2 text-xs text-muted">
                Issued {new Date(t.createdAt).toLocaleString("en-IN")}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Run from the folder that contains <code>install.ps1</code> and{" "}
              <code>update.ps1</code>. If PowerShell is already open there, paste as-is.
            </p>
            <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background-elevated)] p-2 text-xs whitespace-pre-wrap">
              {t.installCommand}
            </pre>
            <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background-elevated)] p-2 text-xs whitespace-pre-wrap">
              {t.updateCommand}
            </pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopy(t.installCommand, t.id)}
                className="btn-primary px-3 py-1 text-xs"
              >
                {copiedId === t.id ? "Copied!" : "Copy install command"}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(t.updateCommand, `${t.id}-update`)}
                className="btn-secondary px-3 py-1 text-xs"
              >
                {copiedId === `${t.id}-update` ? "Copied!" : "Copy update command"}
              </button>
              {!compact && (
                <button
                  type="button"
                  onClick={() => handleCopy(t.plainToken, `${t.id}-token`)}
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  {copiedId === `${t.id}-token` ? "Copied!" : "Copy token"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {copyError && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{copyError}</p>
      )}
    </>
  );
}
