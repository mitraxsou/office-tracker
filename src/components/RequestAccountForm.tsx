"use client";

import { useState, type FormEvent } from "react";

export function RequestAccountForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/account-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not submit request");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-4 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-3 text-sm">
        <p className="font-medium text-green-300">Request received</p>
        <p className="mt-1 text-muted">
          If you need access, an admin will review your details. When approved, sign in at Login with
          a Teams one-time code. If you already had an account, use Login now.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted">PwC email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="you@pwc.com"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Display name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Preferred name"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Why you need access (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          rows={3}
          placeholder="Office, team, or pilot context"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full px-4 py-2 disabled:opacity-50">
        {busy ? "Submitting..." : "Submit account request"}
      </button>
    </form>
  );
}
