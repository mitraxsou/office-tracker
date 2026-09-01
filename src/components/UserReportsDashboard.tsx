"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ComplianceTrendChart,
  HoursTrendChart,
  type DailyHoursPoint,
} from "@/components/reports/ReportCharts";
import {
  exportDailyTrendCsv,
  ReportToolbar,
} from "@/components/reports/ReportToolbar";
import { formatHours, formatTime } from "@/lib/visits";

type UserReportData = {
  user: { timezone: string; hoursTarget: number };
  hoursTarget: number;
  dailyTrend: Array<{ date: string; totalHours: number; metTarget: boolean }>;
  visits: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    source: string;
    ssid: string | null;
  }>;
  today: { totalHours: number; metTarget: boolean; agentHealthy: boolean };
  pulse: { pulsesLast24h: number; agentHealthy: boolean };
  range: { days: number; from: string; to: string };
};

export function UserReportsDashboard() {
  const [days, setDays] = useState(30);
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [data, setData] = useState<UserReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visitFilter, setVisitFilter] = useState<"all" | "wifi" | "manual">("all");

  const load = useCallback(async (params: { days?: number; from?: string; to?: string }) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (params.from && params.to) {
      qs.set("from", params.from);
      qs.set("to", params.to);
    } else {
      qs.set("days", String(params.days ?? days));
    }
    const res = await fetch(`/api/user/reports?${qs}`);
    setLoading(false);
    if (!res.ok) return;
    const json = await res.json();
    setData(json);
    setDays(json.range.days);
    setFromKey(json.range.from);
    setToKey(json.range.to);
    setSelectedDate(null);
  }, [days]);

  useEffect(() => {
    void load({ days: 30 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData: DailyHoursPoint[] = useMemo(
    () =>
      (data?.dailyTrend ?? []).map((d) => ({
        date: d.date,
        totalHours: d.totalHours,
        metTarget: d.metTarget,
      })),
    [data],
  );

  const filteredVisits = useMemo(() => {
    if (!data) return [];
    let rows = data.visits;
    if (selectedDate) {
      rows = rows.filter((v) => v.startAt.startsWith(selectedDate));
    }
    if (visitFilter !== "all") {
      rows = rows.filter((v) => v.source === visitFilter);
    }
    return rows;
  }, [data, selectedDate, visitFilter]);

  const periodStats = useMemo(() => {
    if (!data) return null;
    const metDays = data.dailyTrend.filter((d) => d.metTarget).length;
    const totalHours = data.dailyTrend.reduce((s, d) => s + d.totalHours, 0);
    const avgHours = data.dailyTrend.length
      ? totalHours / data.dailyTrend.length
      : 0;
    return { metDays, totalHours, avgHours };
  }, [data]);

  if (loading && !data) {
    return <p className="text-muted">Loading reports...</p>;
  }

  if (!data) {
    return <p className="text-red-400">Failed to load reports.</p>;
  }

  const target = data.hoursTarget ?? data.user.hoursTarget;

  return (
    <div className="space-y-6">
      <ReportToolbar
        days={days}
        fromKey={fromKey}
        toKey={toKey}
        onRangeChange={(p) => load(p)}
        onExport={() =>
          exportDailyTrendCsv(`office-pulse-${fromKey}-${toKey}.csv`, chartData)
        }
      />

      {periodStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Days met target" value={`${periodStats.metDays} / ${data.dailyTrend.length}`} />
          <KpiCard label="Total hours" value={formatHours(periodStats.totalHours)} />
          <KpiCard label="Avg hours / day" value={formatHours(periodStats.avgHours)} />
          <KpiCard
            label="Agent (24h)"
            value={data.pulse.agentHealthy ? "Healthy" : "Stale"}
            highlight={data.pulse.agentHealthy}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <HoursTrendChart
            data={chartData}
            targetHours={target}
            title="Daily office hours"
            selectedDate={selectedDate}
            onBarClick={(date) => setSelectedDate((prev) => (prev === date ? null : date))}
          />
          {selectedDate && (
            <p className="mt-2 text-xs text-muted">
              Filtering visits for <strong className="text-accent">{selectedDate}</strong>.{" "}
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-accent hover:underline"
              >
                Clear
              </button>
            </p>
          )}
        </section>
        <section className="card p-6">
          <ComplianceTrendChart
            data={chartData.map((d) => ({
              ...d,
              compliancePct: d.metTarget ? 100 : 0,
            }))}
            title="Target met per day"
          />
        </section>
      </div>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Visits in range</h2>
          <select
            value={visitFilter}
            onChange={(e) => setVisitFilter(e.target.value as typeof visitFilter)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value="all">All sources</option>
            <option value="wifi">Wi-Fi only</option>
            <option value="manual">Manual only</option>
          </select>
        </div>
        {filteredVisits.length === 0 ? (
          <p className="text-sm text-muted">No visits in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-muted">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Start</th>
                  <th className="py-2 pr-4">End</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2">SSID</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map((v) => {
                  const start = new Date(v.startAt);
                  const end = v.endAt ? new Date(v.endAt) : null;
                  const durationMs = end
                    ? end.getTime() - start.getTime()
                    : 0;
                  return (
                    <tr key={v.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-4">{v.startAt.slice(0, 10)}</td>
                      <td className="py-2 pr-4">
                        {formatTime(start, data.user.timezone)}
                      </td>
                      <td className="py-2 pr-4">
                        {end ? formatTime(end, data.user.timezone) : "open"}
                      </td>
                      <td className="py-2 pr-4">
                        {end ? formatHours(durationMs / (1000 * 60 * 60)) : "—"}
                      </td>
                      <td className="py-2 pr-4">{v.source}</td>
                      <td className="py-2">{v.ssid ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Hover chart bars for details. Click a bar to filter the visits table.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Back to today
        </Link>
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ? "text-green-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}
