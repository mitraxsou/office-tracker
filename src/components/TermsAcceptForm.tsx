"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TermsAcceptFormProps = {
  nextPath: string;
  legalVersion: number;
};

export function TermsAcceptForm({ nextPath, legalVersion }: TermsAcceptFormProps) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError("Please confirm that you accept the Terms and Privacy Policy.");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch("/api/settings/terms-accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next: nextPath }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save acceptance");
      return;
    }

    const body = await res.json();
    router.push(body.redirectTo ?? nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1"
        />
        <span>
          I accept version {legalVersion} of the{" "}
          <Link href="/terms" className="text-accent hover:underline" target="_blank">
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-accent hover:underline" target="_blank">
            Privacy Policy
          </Link>
          . I understand this is a voluntary hobby project, not official PwC tooling, and I use
          the app and Windows agent at my own risk.
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full px-4 py-2">
        {busy ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}
