"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  repoVersion: string;
  agentRolloutMode: "allowlist" | "everyone";
  agentFleetStableVersion: string;
  agentCanaryVersion: string;
  agentRolloutAllowlistEmails: string[];
};

export function AdminAgentRolloutPanel({
  repoVersion,
  agentRolloutMode,
  agentFleetStableVersion,
  agentCanaryVersion,
  agentRolloutAllowlistEmails,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"allowlist" | "everyone">(agentRolloutMode);
  const [fleetStable, setFleetStable] = useState(agentFleetStableVersion);
  const [canary, setCanary] = useState(agentCanaryVersion || repoVersion);
  const [allowlistText, setAllowlistText] = useState(
    agentRolloutAllowlistEmails.join("\n"),
  );
  const [loading, setLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [confirmPromote, setConfirmPromote] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    setPromoteMessage(null);

    const emails = allowlistText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/admin/agent-rollout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentRolloutMode: mode,
        agentFleetStableVersion: fleetStable.trim(),
        agentCanaryVersion: canary.trim(),
        agentRolloutAllowlistEmails: emails,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save agent rollout");
      return;
    }

    const data = await res.json();
    setMode(data.agentRolloutMode);
    setFleetStable(data.agentFleetStableVersion);
    setCanary(data.agentCanaryVersion);
    setAllowlistText((data.agentRolloutAllowlistEmails as string[]).join("\n"));
    setSaved(true);
    router.refresh();
  }

  async function handlePromote() {
    if (!confirmPromote) {
      setError("Check the confirm box before promoting to everyone.");
      return;
    }
    setPromoteLoading(true);
    setError(null);
    setPromoteMessage(null);

    const res = await fetch("/api/admin/agent-rollout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promoteToEveryone: true,
        confirmPromote: true,
      }),
    });

    setPromoteLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Promote failed");
      return;
    }

    const data = await res.json();
    setMode(data.agentRolloutMode);
    setFleetStable(data.agentFleetStableVersion);
    setCanary(data.agentCanaryVersion);
    setConfirmPromote(false);
    setPromoteMessage(
      `Promoted canary ${data.agentCanaryVersion} to everyone. Fleet-stable is now ${data.agentFleetStableVersion}.`,
    );
    router.refresh();
  }

  return (
    <section className="card space-y-4 p-6">
      <header>
        <h2 className="text-lg font-medium">Agent rollout (canary)</h2>
        <p className="mt-1 text-sm text-muted">
          Control which users receive the deploy-tree agent (canary) vs the last
          fleet-stable version. Default is allowlist so only soak users pull a new
          bump. Promote to everyone only after soak looks good (BUG-018).
        </p>
      </header>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Repo / deploy version</dt>
          <dd className="font-mono">{repoVersion}</dd>
        </div>
        <div>
          <dt className="text-muted">Current mode</dt>
          <dd className="font-mono">{mode}</dd>
        </div>
      </dl>

      <form onSubmit={handleSave} className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted">Rollout mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "allowlist" | "everyone")}
            className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
          >
            <option value="allowlist">allowlist (canary only)</option>
            <option value="everyone">everyone</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Fleet-stable version</span>
            <input
              type="text"
              value={fleetStable}
              onChange={(e) => setFleetStable(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono"
              placeholder="1.5.24"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Canary version</span>
            <input
              type="text"
              value={canary}
              onChange={(e) => setCanary(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono"
              placeholder={repoVersion}
            />
            <span className="mt-1 block text-xs text-muted">
              Empty on save is allowed via API; UI defaults to repo version.
            </span>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-muted">Canary allowlist (one email per line)</span>
          <textarea
            value={allowlistText}
            onChange={(e) => setAllowlistText(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save rollout settings"}
        </button>
      </form>

      <div className="border-t border-[var(--border)] pt-4">
        <h3 className="mb-2 font-medium">Promote to everyone</h3>
        <p className="mb-3 text-sm text-muted">
          Copies the current canary version into fleet-stable and sets mode to
          everyone. Soft-update and the daily watchdog will then pull that version
          for all devices. Requires explicit confirm.
        </p>
        <label className="mb-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmPromote}
            onChange={(e) => setConfirmPromote(e.target.checked)}
            className="mt-1"
          />
          <span>
            I confirm canary soak looks good and I want every laptop to target the
            canary version.
          </span>
        </label>
        <button
          type="button"
          onClick={() => void handlePromote()}
          disabled={promoteLoading || !confirmPromote}
          className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
        >
          {promoteLoading ? "Promoting..." : "Promote canary to everyone"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Rollout settings saved.</p>}
      {promoteMessage && <p className="text-sm text-green-400">{promoteMessage}</p>}
    </section>
  );
}
