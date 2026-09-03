"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

type Props = {
  onUserCreated: () => void;
};

export function AdminUserManagement({ onUserCreated }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    email: string;
    installCommand: string;
    updateCommand: string;
    token: string;
  } | null>(null);
  const [copied, setCopied] = useState<"cmd" | "update" | "token" | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });

    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create user");
      return;
    }

    if (data.installCommand && data.token) {
      setResult({
        email: data.user.email,
        installCommand: data.installCommand,
        updateCommand: data.updateCommand ?? "",
        token: data.token,
      });
    }

    setEmail("");
    setName("");
    setPassword("");
    onUserCreated();
  }

  async function handleCopy(text: string, which: "cmd" | "update" | "token") {
    const ok = await copyToClipboard(text);
    if (!ok) {
      setError("Could not copy. Select the text and press Ctrl+C.");
      return;
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Add pilot user</h2>
      <p className="mb-4 text-sm text-muted">
        Create the account with a temporary password. Share the login details and install
        command with the user. Each install token binds to one laptop on first heartbeat.
      </p>

      <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted">Temporary password (min 8 chars)</span>
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono"
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary px-4 py-2 disabled:opacity-50">
            {loading ? "Creating..." : "Create user and issue install token"}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)]/20 p-4 text-sm">
          <p>
            User <strong>{result.email}</strong> created. Send them the temp password and
            install steps below.
          </p>
          <div className="rounded border border-[var(--border)] p-3">
            <p className="text-sm font-medium">Install (first time)</p>
            <p className="mt-1 mb-2 text-xs text-muted">
              Send this for a laptop that has never run the agent. Run it from the extract folder
              that contains <code>install.ps1</code>.
            </p>
            <pre className="overflow-x-auto rounded border bg-[var(--background)] p-3 text-xs whitespace-pre-wrap">
              {result.installCommand}
            </pre>
            <button
              type="button"
              onClick={() => handleCopy(result.installCommand, "cmd")}
              className="btn-secondary mt-2 px-3 py-1 text-xs"
            >
              {copied === "cmd" ? "Copied!" : "Copy install command"}
            </button>
          </div>
          {result.updateCommand ? (
            <div className="rounded border border-[var(--border)] p-3">
              <p className="text-sm font-medium">Update (already installed)</p>
              <p className="mt-1 mb-2 text-xs text-muted">
                Send this only to refresh an existing agent. Same extract folder, which must contain{" "}
                <code>update.ps1</code>.
              </p>
              <pre className="overflow-x-auto rounded border bg-[var(--background)] p-3 text-xs whitespace-pre-wrap">
                {result.updateCommand}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(result.updateCommand, "update")}
                className="btn-secondary mt-2 px-3 py-1 text-xs"
              >
                {copied === "update" ? "Copied!" : "Copy update command"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
