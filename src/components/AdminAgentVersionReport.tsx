"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type VersionDevice = {
  deviceId: string;
  serialNumber: string;
  installedVersion: string | null;
  expectedVersion: string;
  lastSeenAt: string | null;
  status: "unknown" | "needs_update";
};

type VersionUser = {
  userId: string;
  email: string;
  name: string | null;
  devices: VersionDevice[];
};

type VersionReport = {
  fleetStableVersion: string;
  canaryVersion: string;
  rolloutMode: "allowlist" | "everyone";
  allowlistCount: number;
  deviceCount: number;
  userCount: number;
  users: VersionUser[];
};

export function AdminAgentVersionReport() {
  const [report, setReport] = useState<VersionReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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

  const hasUnknown = report?.users.some((user) =>
    user.devices.some((device) => device.status === "unknown"),
  );

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Agents not updated</h2>
          <p className="mt-1 text-xs text-muted">
            Fleet-stable: <code>{report?.fleetStableVersion ?? "..."}</code>. Canary:{" "}
            <code>{report?.canaryVersion ?? "..."}</code>
            {allowlistOnly && report
              ? ` (${report.allowlistCount} allowlisted user${report.allowlistCount === 1 ? "" : "s"}). `
              : ". "}
            {rolloutNote}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-secondary px-3 py-1 text-xs">
          Refresh
        </button>
      </div>

      {loading && <p className="mt-3 text-sm text-muted">Checking agent versions...</p>}
      {!loading && report?.deviceCount === 0 && (
        <p className="mt-3 text-sm text-green-400">
          Every reporting laptop matches its own target.
        </p>
      )}
      {!loading && report && report.deviceCount > 0 && (
        <>
          <p className="mt-3 text-sm text-accent">
            {report.deviceCount} laptop{report.deviceCount === 1 ? "" : "s"} across{" "}
            {report.userCount} user{report.userCount === 1 ? "" : "s"} differ from their target.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Serial</th>
                  <th className="py-2 pr-3">Installed</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.users.flatMap((user) =>
                  user.devices.map((device) => (
                    <tr key={device.deviceId} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/admin/reports/users/${user.userId}`}
                          className="text-accent hover:underline"
                        >
                          {user.email}
                        </Link>
                        {user.name && <span className="block text-xs text-muted">{user.name}</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{device.serialNumber}</td>
                      <td className="py-2 pr-3">{device.installedVersion ?? "not reported"}</td>
                      <td className="py-2 pr-3">{device.expectedVersion}</td>
                      <td className="py-2 pr-3 text-xs text-muted">
                        {device.lastSeenAt
                          ? new Date(device.lastSeenAt).toLocaleString("en-IN")
                          : "never"}
                      </td>
                      <td className="py-2 text-accent">
                        {device.status === "unknown" ? "Unknown version" : "Needs update"}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Target is resolved per user. A laptop already on fleet-stable is current when that user
            is outside the allowlist.
          </p>
          {hasUnknown && (
            <p className="mt-1 text-xs text-muted">
              Unknown version means the laptop has not reported a script version. Soft update
              follows that user&apos;s target. If the laptop has no updater, re-run installation
              once.
            </p>
          )}
        </>
      )}
    </section>
  );
}
