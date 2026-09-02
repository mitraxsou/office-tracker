"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AgentPulseSparkline,
  HoursTrendChart,
  type DailyHoursPoint,
} from "@/components/reports/ReportCharts";
import { GroupedVisitList } from "@/components/reports/GroupedVisitList";
import {
  exportDailyTrendCsv,
  MonthReportToolbar,
} from "@/components/reports/ReportToolbar";
import { VisitCalendar } from "@/components/reports/VisitCalendar";
import { currentMonthKey } from "@/lib/month-range";
import type { MonthlyProgressState } from "@/lib/monthly-progress";
import { formatHours } from "@/lib/visits";

type UserReportData = {
  user: { timezone: string; hoursTarget: number };
  hoursTarget: number;
  monthlyDaysTarget: number;
  monthlyProgress: {
    monthKey: string;
    qualifyingDays: number;
    officeVisitDays: number;
    daysInMonth: number;
    monthlyDaysTarget: number;
    metTarget: boolean;
    remainingDays: number;
    daysElapsed: number;
    progressState: MonthlyProgressState;
  };
  dailyTrend: Array<{ date: string; totalHours: number; laptopActiveHours: number; metTarget: boolean }>;
  visits: Array<{
    id: string;
    startAt: string;
    endAt: string | null;
    source: string;
    ssid: string | null;
  }>;
  today: { totalHours: number; laptopActiveHours: number; metTarget: boolean; agentHealthy: boolean };
  pulse: {
    pulsesLast24h: number;
    agentHealthy: boolean;
    pulseTimeline24h?: number[];
    minutesSinceLastPulse?: number | null;
  };
  range: { days: number; from: string; to: string; month: string };
};

type ViewMode = "charts" | "calendar";
type KpiTone = "success" | "warning" | "danger" | "neutral";

const KPI_TONE_CLASSES: Record<KpiTone, string> = {
  success: "text-green-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  neutral: "",
};

const KPI_BORDER_CLASSES: Record<KpiTone, string> = {
  success: "border-green-500/30",
  warning: "border-amber-500/30",
  danger: "border-red-500/30",
  neutral: "border-[var(--border)]",
};

export function UserReportsDashboard() {
  const [monthKey, setMonthKey] = useState(() => currentMonthKey("Asia/Kolkata"));
  const [data, setData] = useState<UserReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visitFilter, setVisitFilter] = useState<"all" | "wifi" | "manual">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("charts");

  const load = useCallback(async (month: string) => {
    setLoading(true);
    const qs = new URLSearchParams({ month });
    const res = await fetch(`/api/user/reports?${qs}`);
    setLoading(false);
    if (!res.ok) return;
    const json = await res.json();
    setData(json);
    setMonthKey(json.range.month ?? month);
    setSelectedDate(null);
  }, []);

  useEffect(() => {
    void load(monthKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

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
    const totalHours = data.dailyTrend.reduce((s, d) => s + d.totalHours, 0);
    const totalLaptopHours = data.dailyTrend.reduce((s, d) => s + d.laptopActiveHours, 0);
    const avgHours = data.dailyTrend.length
      ? totalHours / data.dailyTrend.length
      : 0;
    const avgLaptopHours = data.dailyTrend.length
      ? totalLaptopHours / data.dailyTrend.length
      : 0;
    return { totalHours, totalLaptopHours, avgHours, avgLaptopHours };
  }, [data]);

  if (loading && !data) {
    return <p className="text-muted">Loading reports...</p>;
  }

  if (!data) {
    return <p className="text-red-400">Failed to load reports.</p>;
  }

  const target = data.hoursTarget ?? data.user.hoursTarget;
  const timezone = data.user.timezone;
  const progress = data.monthlyProgress;
  const monthlyTone = progressStateToTone(progress.progressState);
  const agentTone: KpiTone = data.pulse.agentHealthy ? "success" : "danger";
  const pulseTimeline = data.pulse.pulseTimeline24h ?? Array(24).fill(0);

  return (
    <div className="space-y-6">
      <MonthReportToolbar
        monthKey={monthKey}
        timezone={timezone}
        onMonthChange={setMonthKey}
        onExport={() =>
          exportDailyTrendCsv(`office-pulse-${monthKey}.csv`, chartData)
        }
      />

      <div className="flex gap-2">
        <ViewTab active={viewMode === "charts"} onClick={() => setViewMode("charts")}>
          Charts
        </ViewTab>
        <ViewTab active={viewMode === "calendar"} onClick={() => setViewMode("calendar")}>
          Calendar
        </ViewTab>
      </div>

      {periodStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard
            label="Days met 5h target"
            value={`${progress.qualifyingDays} / ${progress.monthlyDaysTarget}`}
            tooltip={`Days this month with at least ${target}h in office. Monthly goal is ${progress.monthlyDaysTarget} such days (not every calendar day).`}
            tone={monthlyTone}
          />
          <KpiCard
            label="Office days (any visit)"
            value={`${progress.officeVisitDays} / ${progress.daysInMonth}`}
            tooltip={`Days with any office visit or logged hours this month, even if below the ${target}h daily target. Denominator is ${progress.daysInMonth} days in the month.`}
            tone="neutral"
          />
          <KpiCard
            label="Laptop active today"
            value={formatHours(data.today.laptopActiveHours)}
            tooltip="Time from your first agent pulse today to your last (or now if the agent is still running). Counts on any network, not only office Wi-Fi."
            tone="neutral"
          />
          <KpiCard
            label="Total office hours"
            value={formatHours(periodStats.totalHours)}
            tooltip="Total office time across all days in the selected month. Each day runs from first check-in to last check-out (gaps count). Last in-office heartbeat counts unless you checked out manually."
            tone="neutral"
          />
          <KpiCard
            label="Total laptop active"
            value={formatHours(periodStats.totalLaptopHours)}
            tooltip="Total laptop active time this month: first to last agent pulse per day (any network). Proxy for laptop on with the agent running."
            tone="neutral"
          />
          <KpiCard
            label="Agent (24h)"
            value={data.pulse.agentHealthy ? "Healthy" : "Stale"}
            tooltip={`Laptop agent pulses about every 2 minutes. Healthy means a pulse arrived within the last few minutes. ${data.pulse.pulsesLast24h} pulses in the last 24h.`}
            tone={agentTone}
          >
            <AgentPulseSparkline buckets={pulseTimeline} className="mt-3" />
            <p className="mt-1 text-[10px] text-muted">
              {data.pulse.pulsesLast24h} pulses · last 24h
              {data.pulse.minutesSinceLastPulse != null &&
                ` · ${data.pulse.minutesSinceLastPulse}m ago`}
            </p>
          </KpiCard>
        </div>
      )}

      {viewMode === "calendar" ? (
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-medium">Office visit calendar</h2>
          <VisitCalendar
            monthKey={monthKey}
            timezone={timezone}
            hoursTarget={target}
            dailyTrend={data.dailyTrend}
            visits={data.visits}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </section>
      ) : (
        <section className="card p-6">
          <HoursTrendChart
            data={chartData}
            targetHours={target}
            title="Daily office hours"
            selectedDate={selectedDate}
            onBarClick={(date) => setSelectedDate((prev) => (prev === date ? null : date))}
            height={320}
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
          <p className="mt-3 text-xs text-muted">
            Orange bars meet the daily target. Amber bars are below target. Dashed line is your{" "}
            {target}h goal.
          </p>
        </section>
      )}

      {viewMode === "charts" && (
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Visits this month</h2>
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
            <p className="text-sm text-muted">No visits in this month.</p>
          ) : (
            <GroupedVisitList
              visits={filteredVisits}
              dailyTrend={data.dailyTrend}
              timezone={timezone}
              hoursTarget={target}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}
        </section>
      )}

      <p className="text-xs text-muted">
        {viewMode === "charts"
          ? "Hover chart bars for details. Click a bar or day row to filter visits."
          : "Click a calendar day to see visit details for that day."}{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Back to today
        </Link>
      </p>
    </div>
  );
}

function progressStateToTone(state: MonthlyProgressState): KpiTone {
  if (state === "met") return "success";
  if (state === "on_track") return "warning";
  return "danger";
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--pwc-orange)] text-white"
          : "border border-[var(--border)] text-muted hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
      }`}
    >
      {children}
    </button>
  );
}

function KpiCard({
  label,
  value,
  tooltip,
  tone = "neutral",
  children,
}: {
  label: string;
  value: string;
  tooltip: string;
  tone?: KpiTone;
  children?: React.ReactNode;
}) {
  return (
    <div className={`card border p-4 ${KPI_BORDER_CLASSES[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        <MetricHelp tooltip={tooltip} />
      </div>
      <p className={`mt-1 text-2xl font-semibold ${KPI_TONE_CLASSES[tone]}`}>{value}</p>
      {children}
    </div>
  );
}

function MetricHelp({ tooltip }: { tooltip: string }) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] leading-none text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
        aria-label="Metric help"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2.5 py-2 text-left text-[11px] leading-snug text-muted shadow-lg group-hover:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </span>
  );
}
