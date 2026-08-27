"use client";

import { useEffect, useState } from "react";
import { AdminVisitForm } from "./AdminVisitForm";

type DailyPoint = { date: string; totalHours: number; compliancePct: number };

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
  auditLog: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorEmail: string;
    targetEmail: string | null;
  }>;
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const res = await fetch("/api/admin/reports");

    if (!silent) setLoading(false);
    else setRefreshing(false);

    if (!res.ok) {
      if (!silent) setError("Failed to load reports");
      return;
    }
    setError(null);
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const maxHours = data
    ? Math.max(...data.dailyTrend.map((d) => d.totalHours), data.summary.hoursTarget)
    : 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        {refreshing && <span className="text-xs text-muted">Refreshing...</span>}
        <button
          type="button"
          onClick={() => load(true)}
          className="btn-secondary px-3 py-1 text-xs"
        >
          Refresh reports
        </button>
      </div>

      {loading && !data && <p className="text-muted">Loading reports...</p>}
      {error && !data && <p className="text-red-400">{error}</p>}

      {data && (
        <>
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
            <h2 className="mb-4 text-lg font-medium">Admin activity log</h2>
            {data.auditLog.length === 0 ? (
              <p className="text-sm text-muted">No admin actions yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {data.auditLog.map((log) => (
                  <li key={log.id} className="py-2">
                    <span className="text-muted">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </span>
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
        </>
      )}
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
