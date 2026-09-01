"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminVisitManager } from "./AdminVisitManager";

type UserReport = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    timezone: string;
    hoursTarget: number;
  };
  today: {
    totalHours: number;
    metTarget: boolean;
    agentHealthy: boolean;
    inOfficeNow: boolean;
    lastHeartbeat: string | null;
  };
  dailyTrend: Array<{ date: string; totalHours: number; metTarget: boolean }>;
  visits: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    source: string;
    ssid: string | null;
  }>;
  heartbeats: Array<{
    id: string;
    recordedAt: string;
    inOffice: boolean;
    ssid: string | null;
  }>;
  pulse: {
    pulsesLast24h: number;
    expectedPulsesPerDay: number;
    minutesSinceLastPulse: number | null;
    agentHealthy: boolean;
    lastHeartbeat: string | null;
    recentPulses: Array<{ recordedAt: string; inOffice: boolean; ssid: string | null }>;
  };
  devices: Array<{ id: string; serialNumber: string; lastSeenAt: string | null }>;
  tokens: Array<{
    id: string;
    prefix: string;
    label: string | null;
    status: string;
    boundSerialNumber: string | null;
    expiresAt: string | null;
  }>;
  range: { days: number };
};

export function AdminUserReport({ userId }: { userId: string }) {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<UserReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetScope, setResetScope] = useState<"tracking" | "all">("tracking");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${userId}/reports?days=${days}`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load user report");
      return;
    }
    setData(await res.json());
    setError(null);
  }, [userId, days]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReset() {
    if (resetConfirm !== "RESET") {
      setActionError('Type RESET to confirm');
      return;
    }
    setActionError(null);
    const res = await fetch(`/api/admin/users/${userId}/reset-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: resetScope, confirm: "RESET" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Reset failed");
      return;
    }
    setResetConfirm("");
    load();
  }

  async function handleDeleteUser() {
    if (!confirm(`Delete user ${data?.user.email} and all their data permanently?`)) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Delete failed");
      return;
    }
    router.push("/admin");
  }

  if (loading && !data) return <p className="text-muted">Loading user report...</p>;
  if (error && !data) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  const maxHours = Math.max(...data.dailyTrend.map((d) => d.totalHours), data.user.hoursTarget);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-accent hover:underline">
            ← Back to reports
          </Link>
          <h2 className="mt-1 text-xl font-medium">{data.user.email}</h2>
          {data.user.name && <p className="text-sm text-muted">{data.user.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">
            Range
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="ml-2 rounded-lg border px-2 py-1"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          <button type="button" onClick={() => load()} className="btn-secondary px-3 py-1 text-xs">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Today" value={`${data.today.totalHours.toFixed(1)}h / ${data.user.hoursTarget}h`} />
        <SummaryCard label="5h met" value={data.today.metTarget ? "Yes" : "No"} />
        <SummaryCard
          label="Agent"
          value={data.pulse.agentHealthy ? "Healthy" : data.pulse.lastHeartbeat ? "Stale" : "No pulses"}
        />
        <SummaryCard label="Pulses (24h)" value={`${data.pulse.pulsesLast24h} / ~${data.pulse.expectedPulsesPerDay}`} />
      </div>

      <section className="card p-6">
        <h3 className="mb-3 text-sm font-medium">Daily hours ({data.range.days} days)</h3>
        <div className="flex h-32 items-end gap-1">
          {data.dailyTrend.map((d) => {
            const height = maxHours > 0 ? Math.max(4, (d.totalHours / maxHours) * 100) : 4;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{d.totalHours}h</span>
                <div
                  className={`w-full rounded-t ${d.metTarget ? "bg-green-500" : "bg-[var(--pwc-orange)]"}`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-6">
        <h3 className="mb-3 text-sm font-medium">Agent pulse</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Last heartbeat</dt>
            <dd>
              {data.pulse.lastHeartbeat
                ? new Date(data.pulse.lastHeartbeat).toLocaleString("en-IN")
                : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Minutes since last pulse</dt>
            <dd>{data.pulse.minutesSinceLastPulse ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">In office now</dt>
            <dd>{data.today.inOfficeNow ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted">Registered laptops</dt>
            <dd>{data.devices.length}</dd>
          </div>
        </dl>
        {data.pulse.recentPulses.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {data.pulse.recentPulses.map((p, i) => (
              <li key={i}>
                {new Date(p.recordedAt).toLocaleString("en-IN")} ·{" "}
                {p.inOffice ? "in office" : "out"} · {p.ssid ?? "no SSID"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h3 className="mb-3 text-sm font-medium">Recent heartbeats (retention window)</h3>
        {data.heartbeats.length === 0 ? (
          <p className="text-sm text-muted">No heartbeats in range.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-muted">
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">In office</th>
                  <th className="py-1">SSID</th>
                </tr>
              </thead>
              <tbody>
                {data.heartbeats.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--border)]">
                    <td className="py-1 pr-2">{new Date(h.recordedAt).toLocaleString("en-IN")}</td>
                    <td className="py-1 pr-2">{h.inOffice ? "Yes" : "No"}</td>
                    <td className="py-1 font-mono">{h.ssid ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminVisitManager userId={userId} onChanged={load} />

      <section className="card border-red-500/30 p-6">
        <h3 className="mb-2 text-lg font-medium text-red-400">Testing: reset or delete user</h3>
        <p className="mb-4 text-sm text-muted">
          Reset clears visits and heartbeats for testing. &quot;All data&quot; also revokes tokens and
          removes devices. Delete removes the user account entirely.
        </p>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={resetScope === "tracking"}
              onChange={() => setResetScope("tracking")}
            />
            Tracking only (visits + heartbeats)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={resetScope === "all"}
              onChange={() => setResetScope("all")}
            />
            All agent data (+ tokens + devices)
          </label>
        </div>
        <input
          type="text"
          placeholder='Type RESET to confirm'
          value={resetConfirm}
          onChange={(e) => setResetConfirm(e.target.value)}
          className="mb-3 w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleReset} className="btn-secondary px-4 py-2 text-sm">
            Reset user data
          </button>
          <button
            type="button"
            onClick={handleDeleteUser}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete user account
          </button>
        </div>
        {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
