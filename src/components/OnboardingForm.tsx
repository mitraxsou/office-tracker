"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AGENT_PRODUCT_NAME, APP_NAME } from "@/lib/agent-branding";
import { PriorComplianceOnboardingStep } from "@/components/PriorComplianceOnboardingStep";

type Props = {
  currentEmail: string;
  currentName: string | null;
  canSetPassword: boolean;
  timezone: string;
  needsPriorComplianceStep: boolean;
};

export function OnboardingForm({
  currentEmail,
  currentName,
  canSetPassword,
  timezone,
  needsPriorComplianceStep,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "prior_compliance">(
    needsPriorComplianceStep && currentName ? "prior_compliance" : "profile",
  );
  const [name, setName] = useState(currentName ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        password: password || undefined,
        confirmPassword: confirmPassword || undefined,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save profile");
      return;
    }

    setSaved(true);
    if (needsPriorComplianceStep) {
      setStep("prior_compliance");
    } else {
      router.refresh();
    }
  }

  if (step === "prior_compliance") {
    return (
      <PriorComplianceOnboardingStep
        timezone={timezone}
        onComplete={() => router.refresh()}
      />
    );
  }

  return (
    <section className="card card-brand card-wash border border-[var(--pwc-orange)]/40 p-6">
      <h2 className="text-lg font-semibold">Welcome to {APP_NAME}</h2>
      <p className="mt-2 text-sm text-muted">
        Your account is ready. Add a display name and optional password, then install the{" "}
        {AGENT_PRODUCT_NAME} agent on your laptop. Your install token was created automatically.
      </p>
      <p className="mt-2 text-sm text-muted">
        Signed in as <span className="font-medium text-foreground">{currentEmail}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">Display name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How you appear in admin reports"
            className="w-full max-w-md rounded-lg border px-3 py-2"
          />
        </div>

        {canSetPassword && (
          <>
            <div>
              <label className="mb-1 block text-sm text-muted">Password (optional)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="w-full max-w-md rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                className="w-full max-w-md rounded-lg border px-3 py-2"
              />
            </div>
            <p className="text-xs text-muted">
              Skip password to keep OTP-only sign-in. You can set a password later in Settings.
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary px-4 py-2 disabled:opacity-50">
            {saving ? "Saving..." : needsPriorComplianceStep ? "Save and continue" : "Save and continue"}
          </button>
          {needsPriorComplianceStep ? (
            <button
              type="button"
              onClick={() => setStep("prior_compliance")}
              className="text-sm text-accent hover:underline"
            >
              Skip profile for now
            </button>
          ) : (
            <Link href="/dashboard" className="text-sm text-accent hover:underline">
              Skip for now
            </Link>
          )}
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {saved && !needsPriorComplianceStep && (
        <p className="mt-3 text-sm text-green-500">
          Profile saved. Copy the install command in the section below, or open the dashboard.
        </p>
      )}
    </section>
  );
}
