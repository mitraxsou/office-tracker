"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import type { InstallTokenForUser } from "@/lib/install-token-types";

type InstallTokenCommandsProps = {
  installTokens: InstallTokenForUser[];
  legacyBoundCount?: number;
  compact?: boolean;
};

export function needsRefreshInstallCommands(
  installTokens: InstallTokenForUser[],
  legacyBoundCount = 0,
): boolean {
  return legacyBoundCount > 0 || installTokens.some((t) => t.usesLocalConfig);
}

export function InstallTokenCommands({
  installTokens,
  legacyBoundCount = 0,
  compact = false,
}: InstallTokenCommandsProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [storingId, setStoringId] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<Record<string, string>>({});
  const [pasteToken, setPasteToken] = useState<Record<string, string>>({});
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});

  async function handleRefreshInstallCommands() {
    if (
      !confirm(
        "This creates a new laptop token with full copy-paste commands. Your old token stops working until you run the new command. Continue?",
      )
    ) {
      return;
    }

    setRefreshing(true);
    setRefreshError(null);
    const res = await fetch("/api/settings/refresh-install-commands", { method: "POST" });
    setRefreshing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setRefreshError(body.error ?? "Could not refresh install commands");
      return;
    }
    router.refresh();
  }

  async function handleGenerateInstallCommand() {
    if (
      !confirm(
        "This creates a new laptop token and invalidates any old token until you run the new setup command. Continue?",
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
      setGenerateError(body.error ?? "Could not generate setup command");
      return;
    }
    router.refresh();
  }

  async function handleStoreToken(tokenId: string) {
    const value = pasteToken[tokenId]?.trim();
    if (!value) {
      setStoreError((prev) => ({ ...prev, [tokenId]: "Paste your token first." }));
      return;
    }

    setStoringId(tokenId);
    setStoreError((prev) => ({ ...prev, [tokenId]: "" }));
    const res = await fetch(`/api/settings/tokens/${tokenId}/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: value }),
    });
    setStoringId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStoreError((prev) => ({
        ...prev,
        [tokenId]: body.error ?? "Could not save token",
      }));
      return;
    }
    setPasteToken((prev) => ({ ...prev, [tokenId]: "" }));
    router.refresh();
  }

  function maskToken(token: string) {
    if (token.length <= 12) return "••••••••";
    return `${token.slice(0, 8)}••••••••${token.slice(-4)}`;
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

  const showRefreshCallout = needsRefreshInstallCommands(installTokens, legacyBoundCount);

  if (installTokens.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
        <p className="font-medium text-amber-200/90">Get your reinstall command</p>
        <p className="mt-1 text-muted">
          Generate a token, extract the agent zip, open PowerShell in that folder, then paste the
          reinstall command.
        </p>
        <ol className="mt-4 list-decimal space-y-4 pl-5">
          <li>
            <span className="font-medium text-foreground">Generate token</span>
            <p className="mt-1 text-xs text-muted">
              Creates a laptop token and the one-line setup command for this server.
            </p>
            <button
              type="button"
              onClick={() => void handleGenerateInstallCommand()}
              disabled={generating}
              className="btn-primary mt-2 px-3 py-1.5 text-xs"
            >
              {generating ? "Generating..." : "Generate setup command"}
            </button>
            {generateError && (
              <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {generateError}
              </p>
            )}
          </li>
          <li>
            <span className="font-medium text-muted">Copy reinstall command</span>
            <p className="mt-1 text-xs text-muted">
              After step 1, a laptop card appears here with{" "}
              <strong>Copy reinstall command</strong>.
            </p>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <>
      {showRefreshCallout && (
        <div
          id="refresh-install-commands"
          className="mb-4 scroll-mt-header rounded-lg border border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange)]/10 p-4 text-sm"
        >
          <p className="font-medium text-[var(--pwc-orange)]">Refresh install commands</p>
          <p className="mt-1 text-xs text-muted">
            Your saved commands may read the token from the laptop config file or an older binding.
            Issue a fresh token so copy-paste setup includes the full command again.
          </p>
          <button
            type="button"
            onClick={() => void handleRefreshInstallCommands()}
            disabled={refreshing}
            className="btn-primary mt-3 px-3 py-1.5 text-xs"
          >
            {refreshing ? "Working..." : "Refresh install commands"}
          </button>
          {refreshError && (
            <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {refreshError}
            </p>
          )}
        </div>
      )}
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

            <div className="mt-3 rounded border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange)]/5 p-3">
              <p className="text-sm font-medium text-[var(--pwc-orange)]">Reinstall command</p>
              <p className="mt-1 text-xs text-muted">
                Run from the extracted zip folder in PowerShell. Installs the latest agent from
                this server (first install, update, or repair).
              </p>
              <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background-elevated)] p-2 text-xs whitespace-pre-wrap">
                {t.setupCommand}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(t.setupCommand, `${t.id}-setup`)}
                className="btn-primary mt-2 px-3 py-1.5 text-xs"
              >
                {copiedId === `${t.id}-setup` ? "Copied!" : "Copy reinstall command"}
              </button>
              <a
                href="/api/agent/download"
                className="btn-secondary mt-2 inline-block px-3 py-1.5 text-xs"
              >
                Download agent (.zip)
              </a>
            </div>

            <div className="mt-3 rounded border border-[var(--border)] bg-[var(--background-elevated)] p-3">
              <p className="text-sm font-medium">Laptop token</p>
              {t.plainToken ? (
                <>
                  <p className="mt-1 text-xs text-muted">
                    Use this token for IT troubleshooting. Prefix: <code>{t.prefix}</code>
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded border bg-[var(--background)] p-2 text-xs break-all whitespace-pre-wrap">
                    {showToken[t.id] ? t.plainToken : maskToken(t.plainToken)}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setShowToken((prev) => ({ ...prev, [t.id]: !prev[t.id] }))
                      }
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      {showToken[t.id] ? "Hide token" : "Show full token"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(t.plainToken!, `${t.id}-token`)}
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      {copiedId === `${t.id}-token` ? "Copied!" : "Copy token"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-2 text-xs text-muted">
                  <p>
                    Full token is not stored on the server yet for this laptop (prefix{" "}
                    <code>{t.prefix}</code>). Paste it from your laptop config file once, or wait
                    for the next agent sync and refresh this page.
                  </p>
                  <p className="font-mono text-[11px] text-foreground/80">
                    (Get-Content &quot;$env:LOCALAPPDATA\OfficeTracker\config.json&quot; -Raw |
                    ConvertFrom-Json).token
                  </p>
                  <input
                    type="password"
                    value={pasteToken[t.id] ?? ""}
                    onChange={(e) =>
                      setPasteToken((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                    placeholder="Paste token from config.json"
                    className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs font-mono"
                    autoComplete="off"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStoreToken(t.id)}
                      disabled={storingId === t.id}
                      className="btn-primary px-3 py-1 text-xs"
                    >
                      {storingId === t.id ? "Saving..." : "Save token for this laptop"}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.refresh()}
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      Refresh page
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRefreshInstallCommands()}
                      disabled={refreshing}
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      {refreshing ? "Working..." : "Issue new token instead"}
                    </button>
                  </div>
                  {storeError[t.id] && <p className="text-red-400">{storeError[t.id]}</p>}
                  {refreshError && <p className="text-red-400">{refreshError}</p>}
                </div>
              )}
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
