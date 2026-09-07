"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SetInitialPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/settings/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirmPassword }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not set password");
      return;
    }

    setSuccess(true);
    setPassword("");
    setConfirmPassword("");
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Set a password</h2>
      <p className="mt-2 text-sm text-muted">
        You signed up with OTP. Set a password here if you also want to sign in with email and
        password later.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Confirm password</label>
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
          {saving ? "Saving..." : "Set password"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-500">Password saved.</p>}
    </section>
  );
}
