"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type AgentRolloutUserOption = {
  email: string;
  name: string | null;
};

type Props = {
  repoVersion: string;
  agentRolloutMode: "allowlist" | "everyone";
  agentFleetStableVersion: string;
  agentCanaryVersion: string;
  agentRolloutAllowlistEmails: string[];
  users: AgentRolloutUserOption[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AdminAgentRolloutPanel({
  repoVersion,
  agentRolloutMode,
  agentFleetStableVersion,
  agentCanaryVersion,
  agentRolloutAllowlistEmails,
  users,
}: Props) {
  const router = useRouter();
  const listId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"allowlist" | "everyone">(agentRolloutMode);
  const [fleetStable, setFleetStable] = useState(agentFleetStableVersion);
  const [canary, setCanary] = useState(agentCanaryVersion || repoVersion);
  const [selectedEmails, setSelectedEmails] = useState<string[]>(() =>
    agentRolloutAllowlistEmails.map(normalizeEmail).filter(Boolean),
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState<string | null>(null);
  const [confirmPromote, setConfirmPromote] = useState(false);

  const userOptions = useMemo(() => {
    const byEmail = new Map<string, AgentRolloutUserOption>();
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (!email) continue;
      byEmail.set(email, { email, name: user.name });
    }
    // Keep orphan allowlist emails selectable so they can be removed.
    for (const email of selectedEmails) {
      if (!byEmail.has(email)) {
        byEmail.set(email, { email, name: null });
      }
    }
    return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [users, selectedEmails]);

  const filteredOptions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return userOptions;
    return userOptions.filter(
      (user) =>
        user.email.includes(q) || (user.name?.toLowerCase().includes(q) ?? false),
    );
  }, [userOptions, filter]);

  const selectedSet = useMemo(() => new Set(selectedEmails), [selectedEmails]);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  function toggleEmail(email: string) {
    const normalized = normalizeEmail(email);
    setSelectedEmails((prev) =>
      prev.includes(normalized)
        ? prev.filter((entry) => entry !== normalized)
        : [...prev, normalized],
    );
  }

  function removeEmail(email: string) {
    const normalized = normalizeEmail(email);
    setSelectedEmails((prev) => prev.filter((entry) => entry !== normalized));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    setPromoteMessage(null);

    const res = await fetch("/api/admin/agent-rollout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentRolloutMode: mode,
        agentFleetStableVersion: fleetStable.trim(),
        agentCanaryVersion: canary.trim(),
        agentRolloutAllowlistEmails: selectedEmails,
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
    setSelectedEmails(
      ((data.agentRolloutAllowlistEmails as string[]) ?? []).map(normalizeEmail),
    );
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

        <div className="block text-sm">
          <span className="text-muted">Canary allowlist</span>
          <div ref={dropdownRef} className="relative mt-1">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-controls={listId}
              onClick={() => setDropdownOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left"
            >
              <span className={selectedEmails.length === 0 ? "text-muted" : undefined}>
                {selectedEmails.length === 0
                  ? "Select users…"
                  : `${selectedEmails.length} user${selectedEmails.length === 1 ? "" : "s"} selected`}
              </span>
              <span className="text-muted" aria-hidden>
                ▾
              </span>
            </button>

            {dropdownOpen && (
              <div
                id={listId}
                role="listbox"
                aria-multiselectable="true"
                className="absolute z-20 mt-1 max-h-72 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] shadow-xl"
              >
                <div className="border-b border-[var(--border)] p-2">
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter by name or email"
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {filteredOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted">No matching users.</li>
                  ) : (
                    filteredOptions.map((user) => {
                      const checked = selectedSet.has(user.email);
                      return (
                        <li key={user.email}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={checked}
                            onClick={() => toggleEmail(user.email)}
                            className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm ${
                              checked
                                ? "bg-[var(--pwc-orange-muted)]"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              readOnly
                              tabIndex={-1}
                              className="mt-0.5"
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{user.email}</span>
                              {user.name && (
                                <span className="block truncate text-xs text-muted">
                                  {user.name}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </div>

          {selectedEmails.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {selectedEmails.map((email) => (
                <li
                  key={email}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--pwc-orange-muted)] px-2 py-1 text-xs"
                >
                  <span className="truncate font-mono">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="shrink-0 text-muted hover:text-foreground"
                    aria-label={`Remove ${email}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-1 block text-xs text-muted">
            Only selected users receive the canary version while mode is allowlist.
          </span>
        </div>

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
