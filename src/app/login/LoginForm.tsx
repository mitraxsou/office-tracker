"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  error?: string;
  lockedOut: boolean;
  lockoutMessage: string;
  passwordLogin: (formData: FormData) => void;
};

export function LoginForm({
  error,
  lockedOut,
  lockoutMessage,
  passwordLogin,
}: LoginFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const displayError = error ?? localError;

  useEffect(() => {
    if (error) setLocalError(null);
  }, [error]);

  async function handleRequestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    setSentMessage(null);

    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLocalError(body.error ?? "Could not send code");
      return;
    }

    setStep("code");
    setSentMessage("Check Microsoft Teams for your 6-digit sign-in code.");
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);

    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLocalError(body.error ?? "Sign-in failed");
      return;
    }

    const body = await res.json();
    router.push(body.redirectTo ?? "/dashboard");
    router.refresh();
  }

  return (
    <div className="card w-full max-w-md p-8 shadow-xl">
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full bg-[var(--pwc-orange)]" />
        <h1 className="text-2xl font-semibold">Office Tracker</h1>
      </div>
      <p className="text-sm text-muted">
        Sign in with your PwC email. We send a one-time code to Microsoft Teams.
      </p>

      {displayError && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {displayError}
        </p>
      )}
      {lockedOut && !displayError && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {lockoutMessage}
        </p>
      )}
      {sentMessage && (
        <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {sentMessage}
        </p>
      )}

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted">PwC email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={busy || lockedOut} className="btn-primary w-full px-4 py-2">
            {busy ? "Sending..." : "Send code to Teams"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
          <p className="text-sm text-muted">
            Code sent to <strong>{email}</strong>
          </p>
          <div>
            <label className="mb-1 block text-sm text-muted">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border px-3 py-2 font-mono tracking-widest"
              autoComplete="one-time-code"
            />
          </div>
          <button type="submit" disabled={busy || lockedOut} className="btn-primary w-full px-4 py-2">
            {busy ? "Verifying..." : "Verify and sign in"}
          </button>
          <button
            type="button"
            className="w-full text-sm text-muted hover:text-accent"
            onClick={() => {
              setStep("email");
              setCode("");
              setSentMessage(null);
              setLocalError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="text-sm text-accent hover:underline"
        >
          {showPassword ? "Hide password sign-in" : "Sign in with password"}
        </button>

        {showPassword && (
          <form action={passwordLogin} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted">Email</label>
              <input
                name="email"
                type="email"
                required
                defaultValue={email}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Password</label>
              <input
                name="password"
                type="password"
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={lockedOut}
              className="btn-secondary w-full px-4 py-2"
            >
              Sign in with password
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        New to Office Pulse?{" "}
        <Link href="/help" className="text-accent hover:underline">
          Read the setup guide
        </Link>
      </p>
    </div>
  );
}
