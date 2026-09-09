"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  required?: boolean;
  isBreakglass?: boolean;
};

export function ChangePasswordForm({ required, isBreakglass }: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (isBreakglass) {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="mt-2 text-sm text-muted">
          Breakglass password is managed via server environment. Contact platform ops to update
          BREAKGLASS_PASSWORD.
        </p>
      </section>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/settings/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Password change failed");
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Change password</h2>
      {required && (
        <p className="mt-2 rounded-lg border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)]/20 px-3 py-2 text-sm">
          Set a new password before using the rest of My Office Pulse.
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        Use at least 8 characters. After an admin reset, sign in with the temporary password, then
        set your own password here.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary px-4 py-2 disabled:opacity-50">
          {saving ? "Saving..." : "Update password"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {success && (
        <p className="mt-3 text-sm text-green-500">Password updated. You can continue using My Office Pulse.</p>
      )}
    </section>
  );
}
