"use client";

import { useEffect, useState } from "react";
import { AdminVisitForm } from "./AdminVisitForm";
import { AdminUserManagement } from "./AdminUserManagement";
import { copyToClipboard } from "@/lib/clipboard";

type TokenRow = {
  id: string;
  prefix: string;
  label: string | null;
  boundSerialNumber: string | null;
  status: "pending" | "bound";
  createdAt: string;
  lastUsedAt: string | null;
};

type DailyPoint = { date: string; totalHours: number; compliancePct: number };
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  hoursTarget: number;
  tokens: TokenRow[];
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
  actor: { id: string; email: string };
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
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);
  const [tokenLoadingId, setTokenLoadingId] = useState<string | null>(null);
  const [issuedCommand, setIssuedCommand] = useState<string | null>(null);

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
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function removeDevice(deviceId: string) {
    const res = await fetch(`/api/admin/devices/${deviceId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function changeRole(userId: string, role: "admin" | "user") {
    setRoleLoadingId(userId);
    setRoleError(null);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    setRoleLoadingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setRoleError(body.error ?? "Failed to update role");
      return;
    }

    load();
  }

  async function issueToken(userId: string) {
    setTokenLoadingId(userId);
    setIssuedCommand(null);
    const res = await fetch(`/api/admin/users/${userId}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setTokenLoadingId(null);
    if (!res.ok) {
      setRoleError("Failed to issue token");
      return;
    }
    const body = await res.json();
    if (body.installCommand) {
      await copyToClipboard(body.installCommand);
      setIssuedCommand(body.installCommand);
    }
    load();
  }

  if (loading) return <p className="text-muted">Loading reports...</p>;
  if (error || !data) return <p className="text-red-400">{error ?? "No data"}</p>;

  const maxHours = Math.max(...data.dailyTrend.map((d) => d.totalHours), data.summary.hoursTarget);
  const recentAgentEvents = data.auditLog.filter((l) => l.action === "agent_device_registered");

  return (
    <div className="space-y-6">
      <AdminUserManagement onUserCreated={load} />

      {issuedCommand && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
          Install command copied to clipboard. Send it to the user (they run it inside the
          extracted agent folder).
          <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">{issuedCommand}</pre>
        </div>
      )}

      {recentAgentEvents.length > 0 && (
        <section className="card border-green-500/30 p-4">
          <h2 className="mb-2 text-sm font-medium text-green-300">Recent agent registrations</h2>
          <ul className="space-y-1 text-sm">
            {recentAgentEvents.slice(0, 5).map((log) => (
              <li key={log.id}>
                {new Date(log.createdAt).toLocaleString("en-IN")} ·{" "}
                {log.targetEmail ?? "user"} · serial{" "}
                <code>{String(log.details?.serialNumber ?? "?")}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        {roleError && <p className="mb-3 text-sm text-red-400">{roleError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-muted">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Today</th>
                <th className="py-2 pr-4">5h met</th>
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Tokens / devices</th>
                <th className="py-2 pr-4">Last heartbeat</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const isSelf = u.id === data.actor.id;
                const isAdmin = u.role === "admin";
                return (
                <tr key={u.id} className="border-b border-[var(--border)]">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{u.email}</div>
                    {u.name && <div className="text-xs text-muted">{u.name}</div>}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${
                        isAdmin ? "bg-[var(--pwc-orange)]/20 text-accent" : "bg-[var(--border)] text-muted"
                      }`}
                    >
                      {isAdmin ? "Admin" : "User"}
                    </span>
                    {!(isSelf && isAdmin) && (
                      <button
                        type="button"
                        disabled={roleLoadingId === u.id}
                        onClick={() => changeRole(u.id, isAdmin ? "user" : "admin")}
                        className="ml-2 text-xs text-accent hover:underline disabled:opacity-50"
                      >
                        {roleLoadingId === u.id
                          ? "..."
                          : isAdmin
                            ? "Remove admin"
                            : "Make admin"}
                      </button>
                    )}
                    {isSelf && isAdmin && (
                      <span className="ml-2 text-xs text-muted">(you)</span>
                    )}
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
                  <td className="py-3 pr-4 text-xs">
                    <div className="space-y-2">
                      {u.tokens.length === 0 ? (
                        <span className="text-muted">No tokens</span>
                      ) : (
                        u.tokens.map((t) => (
                          <div key={t.id}>
                            <span
                              className={
                                t.status === "bound" ? "text-green-400" : "text-amber-300"
                              }
                            >
                              {t.label ?? t.prefix} · {t.status}
                            </span>
                            {t.boundSerialNumber && (
                              <code className="ml-1">{t.boundSerialNumber}</code>
                            )}
                          </div>
                        ))
                      )}
                      {u.devices.map((d) => (
                        <div key={d.id} className="flex items-center gap-2">
                          <code>{d.serialNumber}</code>
                          <button
                            type="button"
                            onClick={() => removeDevice(d.id)}
                            className="text-red-400 hover:underline"
                          >
                            remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted">
                    {u.today.lastHeartbeat
                      ? new Date(u.today.lastHeartbeat).toLocaleString("en-IN")
                      : "None"}
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      disabled={tokenLoadingId === u.id}
                      onClick={() => issueToken(u.id)}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      {tokenLoadingId === u.id ? "..." : "Issue laptop token"}
                    </button>
                  </td>
                </tr>
              );
              })}
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
