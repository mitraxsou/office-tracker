"use client";

import { useEffect, useState } from "react";
import { AdminVisitForm } from "./AdminVisitForm";

type DailyPoint = { date: string; totalHours: number; compliancePct: number };
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
    lastHeartbeat: string | null;
  };
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  actorEmail: string;
  targetEmail: string | null;
  details: Record<string, unknown> | null;
};

type ReportsData = {
  summary: {
    totalUsers: number;
    inOfficeNow: number;
    metTodayPct: number;
    avgHours: number;
    hoursTarget: number;
  };
  dailyTrend: DailyPoint[];
  statusBreakdown: { inOffice: number; notInOffice: number; noAgent: number };
  users: UserRow[];
  auditLog: AuditEntry[];
};

function BarChart({
  data,
  valueKey,
  maxValue,
  label,
  suffix = "",
}: {
  data: DailyPoint[];
  valueKey: "totalHours" | "compliancePct";
  maxValue: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium">{label}</p>
      <div className="flex h-40 items-end gap-2">
        {data.map((d) => {
          const value = d[valueKey];
          const height = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted">
                {value}
                {suffix}
              </span>
              <div
                className="w-full rounded-t bg-[var(--pwc-orange)]"
                style={{ height: `${height}%` }}
                title={`${d.date}: ${value}${suffix}`}
              />
              <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusChart({ breakdown }: { breakdown: ReportsData["statusBreakdown"] }) {
  const total = breakdown.inOffice + breakdown.notInOffice + breakdown.noAgent || 1;
  const segments = [
    { label: "In office", value: breakdown.inOffice, color: "bg-green-500" },
    { label: "Not in office", value: breakdown.notInOffice, color: "bg-blue-500" },
    { label: "No agent", value: breakdown.noAgent, color: "bg-gray-500" },
  ];

  return (
    <div>
      <p className="mb-3 text-sm font-medium">Users by status today</p>
      <div className="flex h-6 overflow-hidden rounded-full">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              className={`${s.color}`}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ) : null
        )}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        {segments.map((s) => (
          <li key={s.label}>
            {s.label}: {s.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reports");
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load reports");
      return;
    }
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function removeDevice(deviceId: string) {
    const res = await fetch(`/api/admin/devices/${deviceId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (loading) return <p className="text-muted">Loading reports...</p>;
  if (error || !data) return <p className="text-red-400">{error ?? "No data"}</p>;

  const maxHours = Math.max(...data.dailyTrend.map((d) => d.totalHours), data.summary.hoursTarget);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total users" value={String(data.summary.totalUsers)} />
        <SummaryCard label="In office now" value={String(data.summary.inOfficeNow)} />
        <SummaryCard label="Met 5h today" value={`${data.summary.metTodayPct}%`} />
        <SummaryCard label="Avg hours today" value={`${data.summary.avgHours}h`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <BarChart
            data={data.dailyTrend}
            valueKey="totalHours"
            maxValue={maxHours}
            label="Daily office hours (last 7 days, all users)"
            suffix="h"
          />
        </section>
        <section className="card p-6">
          <BarChart
            data={data.dailyTrend}
            valueKey="compliancePct"
            maxValue={100}
            label="Compliance rate (% met target)"
            suffix="%"
          />
        </section>
      </div>

      <section className="card p-6">
        <StatusChart breakdown={data.statusBreakdown} />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">All users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-muted">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Today</th>
                <th className="py-2 pr-4">5h met</th>
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Last heartbeat</th>
                <th className="py-2">Devices</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
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
                  <td className="py-3 pr-4 text-xs text-muted">
                    {u.today.lastHeartbeat
                      ? new Date(u.today.lastHeartbeat).toLocaleString("en-IN")
                      : "—"}
                  </td>
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
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Admin activity log</h2>
        {data.auditLog.length === 0 ? (
          <p className="text-sm text-muted">No admin actions yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {data.auditLog.map((log) => (
              <li key={log.id} className="py-2">
                <span className="text-muted">{new Date(log.createdAt).toLocaleString("en-IN")}</span>
                {" · "}
                <span className="font-medium">{log.action.replace(/_/g, " ")}</span>
                {" by "}
                {log.actorEmail}
                {log.targetEmail && <> for {log.targetEmail}</>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Correct visit data</h2>
        <AdminVisitForm />
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
