"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  hoursTarget: number;
  devices: Array<{ id: string; serialNumber: string; lastSeenAt: string | null }>;
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

  if (loading) return <p className="text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="overflow-x-auto">
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
              <td className="py-3 pr-4">{u.today.totalHours.toFixed(1)}h / {u.hoursTarget}h</td>
              <td className="py-3 pr-4">
                <span className={u.today.metTarget ? "text-green-400" : "text-accent"}>
                  {u.today.metTarget ? "Yes" : "No"}
                </span>
              </td>
              <td className="py-3 pr-4">{u.today.agentHealthy ? "Healthy" : "Stale"}</td>
              <td className="py-3 pr-4">{u.today.inOfficeNow ? "Yes" : "No"}</td>
              <td className="py-3">
                {u.devices.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <ul className="space-y-1">
                    {u.devices.map((d) => (
                      <li key={d.id} className="flex items-center gap-2">
                        <code className="text-xs">{d.serialNumber}</code>
                        <button
                          type="button"
                          onClick={() => removeDevice(d.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          remove
                        </button>
                      </li>
                    ))}
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
