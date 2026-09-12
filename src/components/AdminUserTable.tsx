"use client";

import { useEffect, useState } from "react";

type DeviceRow = {
  id: string;
  serialNumber: string;
  lastSeenAt: string | null;
  agentScriptVersion: string | null;
  agentVersionStale: boolean;
  forceAgentUpdate: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  hoursTarget: number;
  serverAgentVersion: string;
  devices: DeviceRow[];
  today: {
    totalHours: number;
    metTarget: boolean;
    agentHealthy: boolean;
    inOfficeNow: boolean;
  };
};

export function AdminUserTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load users");
      return;
    }
    const data = await res.json();
    setUsers(data.users);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeDevice(deviceId: string) {
    const res = await fetch(`/api/admin/devices/${deviceId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function pushAgentUpdate(scope: "device" | "user", id: string) {
    setPushing(`${scope}:${id}`);
    const path =
      scope === "device"
        ? `/api/admin/devices/${id}/agent-update`
        : `/api/admin/users/${id}/agent-update`;
    const res = await fetch(path, { method: "POST" });
    setPushing(null);
    if (res.ok) load();
  }

  if (loading) return <p className="text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  const serverVersion = users[0]?.serverAgentVersion ?? "-";

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-xs text-muted">
        Server agent version: <code>{serverVersion}</code>. Push update queues install on next
        agent sync (within ~6 min by default).
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-muted">
            <th className="py-2 pr-4">User</th>
            <th className="py-2 pr-4">Today</th>
            <th className="py-2 pr-4">5h met</th>
            <th className="py-2 pr-4">Agent</th>
            <th className="py-2 pr-4">In office</th>
            <th className="py-2">Devices</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-[var(--border)]">
              <td className="py-3 pr-4">
                <div className="font-medium">{u.email}</div>
                {u.name && <div className="text-xs text-muted">{u.name}</div>}
              </td>
              <td className="py-3 pr-4">
                {u.today.totalHours.toFixed(1)}h / {u.hoursTarget}h
              </td>
              <td className="py-3 pr-4">
                <span className={u.today.metTarget ? "text-green-400" : "text-accent"}>
                  {u.today.metTarget ? "Yes" : "No"}
                </span>
              </td>
              <td className="py-3 pr-4">{u.today.agentHealthy ? "Healthy" : "Stale"}</td>
              <td className="py-3 pr-4">{u.today.inOfficeNow ? "Yes" : "No"}</td>
              <td className="py-3">
                {u.devices.length === 0 ? (
                  <span className="text-muted">None</span>
                ) : (
                  <ul className="space-y-2">
                    {u.devices.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2">
                        <code className="text-xs">{d.serialNumber}</code>
                        <span
                          className={`text-xs ${d.agentVersionStale ? "text-accent" : "text-green-400"}`}
                          title={d.agentScriptVersion ?? "unknown"}
                        >
                          v{d.agentScriptVersion ?? "?"}
                          {d.agentVersionStale ? " (update needed)" : ""}
                          {d.forceAgentUpdate ? " (pending)" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => pushAgentUpdate("device", d.id)}
                          disabled={pushing === `device:${d.id}` || d.forceAgentUpdate}
                          className="text-xs text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {pushing === `device:${d.id}`
                            ? "Pushing..."
                            : d.forceAgentUpdate
                              ? "Update pending"
                              : "Push update"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDevice(d.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {u.devices.length > 1 && (
                      <li>
                        <button
                          type="button"
                          onClick={() => pushAgentUpdate("user", u.id)}
                          disabled={pushing === `user:${u.id}`}
                          className="text-xs text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {pushing === `user:${u.id}` ? "Pushing..." : "Push update to all devices"}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
