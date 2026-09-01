"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

type Props = {
  userId: string;
  userEmail: string;
  disabled?: boolean;
  onDone?: () => void;
  className?: string;
};

export function AdminResetPasswordButton({
  userId,
  userEmail,
  disabled,
  onDone,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleReset() {
    if (
      !confirm(
        `Reset password for ${userEmail}? Share the new temporary password with the user once.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setTempPassword(null);

    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to reset password");
      return;
    }

    const body = await res.json();
    setTempPassword(body.tempPassword);
    onDone?.();
  }

  async function handleCopy() {
    if (!tempPassword) return;
    const ok = await copyToClipboard(tempPassword);
    if (!ok) {
      setError("Could not copy. Select the password and press Ctrl+C.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={handleReset}
        className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
      >
        {busy ? "..." : "Reset password"}
      </button>

      {tempPassword && (
        <div className="mt-3 rounded-lg border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)]/20 p-3 text-sm">
          <p className="mb-2">
            Temporary password for <strong>{userEmail}</strong>. Copy it now. It will not be shown
            again.
          </p>
          <code className="block rounded border bg-[var(--background)] px-3 py-2 font-mono text-sm">
            {tempPassword}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary mt-2 px-3 py-1 text-xs"
          >
            {copied ? "Copied!" : "Copy password"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
