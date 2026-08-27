"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminPilotControls({
  allowRegistration,
  registrationEnvLocked,
}: {
  allowRegistration: boolean;
  registrationEnvLocked: boolean;
}) {
  const router = useRouter();
  const [registrationEnabled, setRegistrationEnabled] = useState(allowRegistration);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSaved, setRegSaved] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  async function handleRegistrationToggle() {
    const next = !registrationEnabled;
    setRegLoading(true);
    setRegError(null);
    setRegSaved(false);

    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowRegistration: next }),
    });

    setRegLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRegError(data.error ?? "Failed to update registration setting");
      return;
    }

    setRegistrationEnabled(next);
    setRegSaved(true);
    router.refresh();
  }

  async function handleReset() {
    if (confirmText !== "RESET") return;

    setResetLoading(true);
    setResetError(null);
    setResetDone(false);

    const res = await fetch("/api/admin/reset-database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "RESET" }),
    });

    setResetLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setResetError(data.error ?? "Database reset failed");
      return;
    }

    setResetDone(true);
    setConfirmText("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="mb-1 text-lg font-medium">Pilot controls</h2>
        <p className="mb-4 text-sm text-muted">Registration and testing tools for the pilot</p>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Allow new user registration</p>
            <p className="mt-1 text-sm text-muted">
              When off, the /register page is blocked. Production env can hard-lock this with
              ALLOW_REGISTRATION=false.
            </p>
            {registrationEnvLocked && (
              <p className="mt-2 text-sm text-accent">
                Locked off by ALLOW_REGISTRATION=false in environment. UI toggle cannot enable
                registration.
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={registrationEnabled}
            disabled={regLoading || registrationEnvLocked}
            onClick={handleRegistrationToggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              registrationEnabled ? "bg-[var(--pwc-orange)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                registrationEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {regError && <p className="mt-3 text-sm text-red-400">{regError}</p>}
        {regSaved && <p className="mt-3 text-sm text-green-400">Registration setting saved.</p>}
      </section>

      <section className="card border border-red-500/40 p-6">
        <h2 className="mb-1 text-lg font-medium text-red-400">Danger zone: reset database</h2>
        <p className="mb-4 text-sm text-muted">
          Wipes all pilot data: users, visits, heartbeats, devices, and audit log. Recreates default
          AppConfig and the breakglass admin from environment variables. Your current session may
          stop working; sign in again with breakglass credentials.
        </p>
        <p className="mb-4 text-sm text-muted">
          For production DB setup during pilot testing, set RUN_DB_SETUP_ON_DEPLOY=true on Vercel.
          Safe to leave on for multiple deploys: each build runs schema push and seed without
          wiping users or visits. Turn it off when the pilot is stable. Schema drift (e.g. missing
          columns) is also fixed automatically at server startup.
        </p>

        <label className="mb-1 block text-sm text-muted">
          Type RESET to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESET"
          className="mb-4 w-full max-w-xs rounded-lg border px-3 py-2 font-mono text-sm"
        />

        {resetError && <p className="mb-3 text-sm text-red-400">{resetError}</p>}
        {resetDone && (
          <p className="mb-3 text-sm text-green-400">
            Database reset complete. Sign in again if your session expired.
          </p>
        )}

        <button
          type="button"
          disabled={resetLoading || confirmText !== "RESET"}
          onClick={handleReset}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetLoading ? "Resetting..." : "Reset database"}
        </button>
      </section>
    </div>
  );
}
