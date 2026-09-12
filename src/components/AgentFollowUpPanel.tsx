"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPulseAge } from "@/lib/pulse-age";

type FollowUpDevice = {
  deviceId: string;
  serialNumber: string;
  label: string | null;
  lastHeartbeatAt: string | null;
  minutesSinceLastPulse: number | null;
  agentStatus: "stale" | "offline";
  agentStatusLabel: string;
  boundTokenLabel: string | null;
  connectionHistory: "had_heartbeats";
};

type FollowUpUser = {
  userId: string;
  email: string;
  name: string | null;
  timezone: string;
  devices: FollowUpDevice[];
  worstAgentStatus: "stale" | "offline";
  stalestMinutesSinceLastPulse: number;
};

type PanelData = {
  count: number;
  staleThresholdHours: number;
  updatedAt: string;
  users: FollowUpUser[];
};

type StatusFilter = "all" | "stale" | "offline";

const REFRESH_MS = 60_000;

function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function statusBadgeClass(status: "stale" | "offline"): string {
  return status === "offline" ? "text-red-400" : "text-accent";
}

export function AgentFollowUpPanel({
  open,
  onClose,
  initialCount,
  onCountChange,
}: {
  open: boolean;
  onClose: () => void;
  initialCount?: number;
  onCountChange?: (count: number) => void;
}) {
  const [data, setData] = useState<PanelData | null>(
    initialCount !== undefined
      ? { count: initialCount, staleThresholdHours: 24, updatedAt: "", users: [] }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(
    async (silent = false, filter: StatusFilter = statusFilter) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const qs = filter === "all" ? "" : `?status=${filter}`;
        const res = await fetch(`/api/admin/agent-health-report${qs}`);
        if (!res.ok) {
          setError("Failed to load agent follow-up report");
          return;
        }
        setError(null);
        const json: PanelData = await res.json();
        setData(json);
        onCountChange?.(json.count);
      } catch {
        setError("Failed to load agent follow-up report");
      } finally {
        if (!silent) setLoading(false);
        else setRefreshing(false);
      }
    },
    [onCountChange, statusFilter],
  );

  useEffect(() => {
    if (!open) return;
    void load(false, statusFilter);
    const timer = setInterval(() => void load(true, statusFilter), REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, load, statusFilter]);

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
        aria-labelledby="agent-follow-up-panel-title"
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--background-elevated)] shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 id="agent-follow-up-panel-title" className="text-lg font-semibold">
              Agent follow-up
            </h2>
            <p className="mt-1 text-sm text-muted">
              Installed agents with no uninstall request, but no recent activity. Check in with
              these users proactively.
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <p className="text-sm">
            <span className="text-2xl font-semibold text-accent">{data?.count ?? 0}</span>
            <span className="ml-2 text-muted">user{data?.count === 1 ? "" : "s"}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value as StatusFilter;
                setStatusFilter(next);
                void load(false, next);
              }}
              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
              aria-label="Filter by agent status"
            >
              <option value="all">All (stale + offline)</option>
              <option value="stale">Stale only</option>
              <option value="offline">Offline only</option>
            </select>
            {refreshing && <span className="text-xs text-muted">Refreshing...</span>}
            <button
              type="button"
              onClick={() => void load(true, statusFilter)}
              className="btn-secondary px-3 py-1 text-xs"
              disabled={loading || refreshing}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && !data?.users.length && <p className="text-sm text-muted">Loading...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {data && data.users.length === 0 && !loading && (
            <p className="text-sm text-muted">
              No installed agents need follow-up right now. Healthy agents and devices pending
              removal are excluded.
            </p>
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
                    <span
                      className={`shrink-0 text-xs font-medium ${statusBadgeClass(user.worstAgentStatus)}`}
                    >
                      {user.worstAgentStatus === "offline" ? "Offline" : "Stale"}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {user.devices.map((device) => (
                      <li
                        key={device.deviceId}
                        className="rounded border border-[var(--border)]/60 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {device.label ?? device.serialNumber}
                          </span>
                          <span className={statusBadgeClass(device.agentStatus)}>
                            {device.agentStatusLabel}
                          </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted">
                          <div>
                            <dt>Last activity</dt>
                            <dd className="text-[var(--foreground)]">
                              {formatWhen(device.lastHeartbeatAt)}
                            </dd>
                          </div>
                          <div>
                            <dt>Since activity</dt>
                            <dd className="text-[var(--foreground)]">
                              {formatPulseAge({
                                minutes: device.minutesSinceLastPulse,
                                lastPulseAt: device.lastHeartbeatAt,
                                timezone: user.timezone,
                              })}
                            </dd>
                          </div>
                          {device.boundTokenLabel && (
                            <div className="col-span-2">
                              <dt>Token</dt>
                              <dd className="text-[var(--foreground)]">{device.boundTokenLabel}</dd>
                            </div>
                          )}
                          <div className="col-span-2">
                            <dt>History</dt>
                            <dd className="text-[var(--foreground)]">
                              Had agent activity before (not never installed)
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href={`/admin/reports/users/${user.userId}`}
                      className="text-xs text-accent hover:underline"
                    >
                      View user report
                    </Link>
                    <a
                      href={`mailto:${user.email}`}
                      className="text-xs text-muted hover:text-accent hover:underline"
                    >
                      Email user
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data?.updatedAt && (
          <footer className="border-t border-[var(--border)] px-5 py-3 text-xs text-muted">
            Stale threshold: {data.staleThresholdHours}h without activity. Last updated{" "}
            {new Date(data.updatedAt).toLocaleTimeString("en-IN")}. Auto-refreshes every 60s.
          </footer>
        )}
      </aside>
    </div>
  );
}

export function useAgentFollowUpCount(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function loadCount() {
      try {
        const res = await fetch("/api/admin/agent-health-report");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setCount(json.count ?? 0);
      } catch {
        if (!cancelled) setCount(null);
      }
    }

    void loadCount();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return [count, setCount] as const;
}
