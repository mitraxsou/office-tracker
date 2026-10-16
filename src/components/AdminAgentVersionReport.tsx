"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 8;

type FleetStatus = "current" | "needs_update" | "unknown";
type StatusFilter = "all" | FleetStatus;

type FleetDevice = {
  deviceId: string;
  serialNumber: string;
  installedVersion: string | null;
  expectedVersion: string;
  lastSeenAt: string | null;
  status: FleetStatus;
  onAllowlist: boolean;
  userId: string;
  email: string;
  name: string | null;
};

type VersionReport = {
  fleetStableVersion: string;
  canaryVersion: string;
  rolloutMode: "allowlist" | "everyone";
  allowlistCount: number;
  deviceCount: number;
  userCount: number;
  fleet: {
    totalDevices: number;
    currentCount: number;
    needsUpdateCount: number;
    unknownCount: number;
    devices: FleetDevice[];
  };
};

function statusLabel(status: FleetStatus): string {
  if (status === "current") return "Current";
  if (status === "unknown") return "Unknown version";
  return "Needs update";
}

function statusTone(status: FleetStatus): string {
  if (status === "current") return "text-[var(--success)]";
  if (status === "unknown") return "text-muted";
  return "text-accent";
}

function statusChipClass(active: boolean): string {
  return active
    ? "border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange-muted)] text-foreground"
    : "border-[var(--border)] bg-transparent text-muted hover:border-[var(--pwc-orange)]/40 hover:text-foreground";
}

export function AdminAgentVersionReport() {
  const [report, setReport] = useState<VersionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/agent-version-report");
    if (response.ok) setReport(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allowlistOnly = !report || report.rolloutMode !== "everyone";
  const rolloutNote = !report
    ? "Each laptop is compared to that user's target."
    : report.rolloutMode === "everyone"
      ? "Rollout mode is everyone, so each laptop is compared to the promoted version."
      : "Laptops outside the allowlist are compared to fleet-stable only. Canary is not the fleet target.";

  const filtered = useMemo(() => {
    const devices = report?.fleet.devices ?? [];
    const q = query.trim().toLowerCase();
    return devices.filter((device) => {
      if (statusFilter !== "all" && device.status !== statusFilter) return false;
      if (!q) return true;
      return (
        device.email.toLowerCase().includes(q) ||
        (device.name?.toLowerCase().includes(q) ?? false) ||
        device.serialNumber.toLowerCase().includes(q) ||
        (device.installedVersion?.toLowerCase().includes(q) ?? false) ||
        device.expectedVersion.toLowerCase().includes(q)
      );
    });
  }, [query, report?.fleet.devices, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filterChips: Array<{ id: StatusFilter; label: string; count: number | null }> = [
    { id: "all", label: "All", count: report?.fleet.totalDevices ?? null },
    { id: "needs_update", label: "Needs update", count: report?.fleet.needsUpdateCount ?? null },
    { id: "current", label: "Current", count: report?.fleet.currentCount ?? null },
    { id: "unknown", label: "Unknown", count: report?.fleet.unknownCount ?? null },
  ];

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium">Agent status</h2>
            <p className="mt-1 text-xs text-muted">
              Fleet-stable: <code>{report?.fleetStableVersion ?? "..."}</code>. Canary:{" "}
              <code>{report?.canaryVersion ?? "..."}</code>
              {allowlistOnly && report
                ? ` (${report.allowlistCount} allowlisted user${report.allowlistCount === 1 ? "" : "s"}). `
                : ". "}
              {rolloutNote}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary px-3 py-1 text-xs"
          >
            Refresh
          </button>
        </div>

        {report && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="Laptops" value={report.fleet.totalDevices} />
            <SummaryStat
              label="Needs update"
              value={report.fleet.needsUpdateCount}
              tone={report.fleet.needsUpdateCount > 0 ? "accent" : "muted"}
            />
            <SummaryStat
              label="Current"
              value={report.fleet.currentCount}
              tone="success"
            />
            <SummaryStat label="Unknown" value={report.fleet.unknownCount} />
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${statusChipClass(
                statusFilter === chip.id,
              )}`}
            >
              {chip.label}
              {chip.count !== null ? ` · ${chip.count}` : ""}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email, name, serial, or version"
            className="min-w-[16rem] flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {loading && <p className="text-sm text-muted">Checking agent versions...</p>}

        {!loading && report && total === 0 && (
          <p className="text-sm text-muted">
            {report.fleet.totalDevices === 0
              ? "No registered laptops yet."
              : "No laptops match this filter."}
          </p>
        )}

        {!loading && report && total > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-muted">
                Showing {rangeStart}-{rangeEnd} of {total}
                {query.trim() ? ` matching "${query.trim()}"` : ""}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-muted">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]/40 text-left text-xs text-muted">
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Serial</th>
                    <th className="px-3 py-2.5">Installed</th>
                    <th className="px-3 py-2.5">Target</th>
                    <th className="px-3 py-2.5">Last seen</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((device) => (
                    <tr
                      key={device.deviceId}
                      className="border-b border-[var(--border)] last:border-b-0"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/reports/users/${device.userId}`}
                          className="text-accent hover:underline"
                        >
                          {device.email}
                        </Link>
                        <span className="mt-0.5 block text-xs text-muted">
                          {device.name ?? "No name"}
                          {device.onAllowlist ? " · Canary allowlist" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{device.serialNumber}</td>
                      <td className="px-3 py-2.5">{device.installedVersion ?? "not reported"}</td>
                      <td className="px-3 py-2.5">{device.expectedVersion}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {device.lastSeenAt
                          ? new Date(device.lastSeenAt).toLocaleString("en-IN")
                          : "never"}
                      </td>
                      <td className={`px-3 py-2.5 text-xs font-medium ${statusTone(device.status)}`}>
                        {statusLabel(device.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-muted">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted">
          Target is resolved per user. A laptop already on fleet-stable is current when that user
          is outside the allowlist.
        </p>
        {(report?.fleet.unknownCount ?? 0) > 0 && (
          <p className="text-xs text-muted">
            Unknown version means the laptop has not reported a script version. Soft update follows
            that user&apos;s target. If the laptop has no updater, re-run installation once.
          </p>
        )}
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "accent" | "success";
}) {
  const valueClass =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
        ? "text-[var(--success)]"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
