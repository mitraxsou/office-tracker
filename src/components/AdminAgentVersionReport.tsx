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
  updateQueued: boolean;
};

type VersionUser = {
  userId: string;
  email: string;
  name: string | null;
  devices: VersionDevice[];
};

type VersionReport = {
  expectedVersion: string;
  deviceCount: number;
  userCount: number;
  users: VersionUser[];
};

export function AdminAgentVersionReport() {
  const [report, setReport] = useState<VersionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/agent-version-report");
    if (response.ok) setReport(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function queueUpdate(deviceId: string) {
    setPushing(deviceId);
    const response = await fetch(`/api/admin/devices/${deviceId}/agent-update`, {
      method: "POST",
    });
    setPushing(null);
    if (response.ok) await load();
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Agents not updated</h2>
          <p className="mt-1 text-xs text-muted">
            Current agent: <code>{report?.expectedVersion ?? "..."}</code>. Version mismatches are
            offered an automatic update during config polling.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-secondary px-3 py-1 text-xs">
          Refresh
        </button>
      </div>

      {loading && <p className="mt-3 text-sm text-muted">Checking agent versions...</p>}
      {!loading && report?.deviceCount === 0 && (
        <p className="mt-3 text-sm text-green-400">All reporting agents are current.</p>
      )}
      {!loading && report && report.deviceCount > 0 && (
        <>
          <p className="mt-3 text-sm text-accent">
            {report.deviceCount} laptop{report.deviceCount === 1 ? "" : "s"} across{" "}
            {report.userCount} user{report.userCount === 1 ? "" : "s"} need attention.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Serial</th>
                  <th className="py-2 pr-3">Installed</th>
                  <th className="py-2 pr-3">Expected</th>
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
                      <td className="py-2">
                        <span className="text-accent">
                          {device.status === "unknown" ? "Unknown version" : "Needs update"}
                          {device.updateQueued ? " (queued)" : ""}
                        </span>
                        <button
                          type="button"
                          disabled={pushing === device.deviceId || device.updateQueued}
                          onClick={() => void queueUpdate(device.deviceId)}
                          className="ml-2 text-xs text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {pushing === device.deviceId
                            ? "Pushing..."
                            : device.updateQueued
                              ? "Update pending"
                              : "Push update"}
                        </button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Unknown version means the laptop is sending pulses with an older script that does not
            report its version. Auto-repair is attempted. If it has no updater, re-run installation
            once.
          </p>
        </>
      )}
    </section>
  );
}
