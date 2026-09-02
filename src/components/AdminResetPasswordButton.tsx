"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { buildPasswordResetMailto } from "@/lib/password-policy";

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

  function closeModal() {
    setTempPassword(null);
    setCopied(false);
    setError(null);
  }

  const mailtoHref =
    tempPassword &&
    buildPasswordResetMailto({
      userEmail,
      tempPassword,
      loginUrl: `${window.location.origin}/login`,
    });

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
          >
            <h3 id="reset-password-title" className="text-lg font-semibold">
              Temporary password
            </h3>
            <p className="mt-2 text-sm text-muted">
              Password for <strong>{userEmail}</strong>. Copy or email it now. It will not be shown
              again.
            </p>
            <code className="mt-4 block rounded border bg-[var(--background)] px-3 py-2 font-mono text-sm">
              {tempPassword}
            </code>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {copied ? "Copied!" : "Copy password"}
              </button>
              {mailtoHref && (
                <a href={mailtoHref} className="btn-secondary px-3 py-1.5 text-sm">
                  Open in Outlook
                </a>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          </div>
        </div>
      )}

      {error && !tempPassword && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
