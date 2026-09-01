"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type InOfficeUser = {
  userId: string;
  email: string;
  name: string | null;
  hoursToday: number;
  hoursTarget: number;
  metTarget: boolean;
  visitStartAt: string | null;
  visitSource: string | null;
  visitSsid: string | null;
  lastHeartbeatAt: string | null;
  lastHeartbeatSource: string | null;
};

type PanelData = {
  count: number;
  updatedAt: string;
  users: InOfficeUser[];
};

const REFRESH_MS = 45_000;

function formatSource(source: string | null): string {
  if (!source) return "Unknown";
  if (source === "wifi") return "Wi-Fi";
  if (source === "manual") return "Manual";
  return source;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export function InOfficeNowPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/admin/in-office-now");
      if (!res.ok) {
        setError("Failed to load in-office users");
        return;
      }
      setError(null);
      setData(await res.json());
    } catch {
      setError("Failed to load in-office users");
    } finally {
      if (!silent) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
    const timer = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-labelledby="in-office-panel-title"
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--background-elevated)] shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 id="in-office-panel-title" className="text-lg font-semibold">
              In office now
            </h2>
            <p className="mt-1 text-sm text-muted">
              Live list of users with an active office visit and recent heartbeat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-2 py-1 text-sm"
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <p className="text-sm">
            <span className="text-2xl font-semibold text-accent">{data?.count ?? 0}</span>
            <span className="ml-2 text-muted">user{data?.count === 1 ? "" : "s"}</span>
          </p>
          <div className="flex items-center gap-2">
            {refreshing && <span className="text-xs text-muted">Refreshing...</span>}
            <button
              type="button"
              onClick={() => void load(true)}
              className="btn-secondary px-3 py-1 text-xs"
              disabled={loading || refreshing}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && !data && <p className="text-sm text-muted">Loading...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {data && data.users.length === 0 && (
            <p className="text-sm text-muted">No users are in the office right now.</p>
          )}

          {data && data.users.length > 0 && (
            <ul className="space-y-3">
              {data.users.map((user) => (
                <li
                  key={user.userId}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.email}</p>
                      {user.name && <p className="truncate text-xs text-muted">{user.name}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-accent">{user.hoursToday}h</p>
                      <p className="text-xs text-muted">of {user.hoursTarget}h</p>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <dt className="text-muted">Since</dt>
                      <dd>{formatWhen(user.visitStartAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Source</dt>
                      <dd>
                        {formatSource(user.visitSource)}
                        {user.visitSsid ? ` (${user.visitSsid})` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Last pulse</dt>
                      <dd>{formatWhen(user.lastHeartbeatAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Target met</dt>
                      <dd className={user.metTarget ? "text-green-400" : "text-accent"}>
                        {user.metTarget ? "Yes" : "No"}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/admin/reports/users/${user.userId}`}
                    className="mt-3 inline-block text-xs text-accent hover:underline"
                  >
                    View user report
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data?.updatedAt && (
          <footer className="border-t border-[var(--border)] px-5 py-3 text-xs text-muted">
            Last updated {new Date(data.updatedAt).toLocaleTimeString("en-IN")}. Auto-refreshes
            every 45s.
          </footer>
        )}
      </aside>
    </div>
  );
}
