"use client";

import { useMemo } from "react";
import {
  AgentPulseSparkline,
  HoursTrendChart,
  type DailyHoursPoint,
} from "@/components/reports/ReportCharts";
import { VisitCalendar } from "@/components/reports/VisitCalendar";
import type { MonthlyProgressState } from "@/lib/monthly-progress";
import { formatHours } from "@/lib/visits";
import { formatPulseAge } from "@/lib/pulse-age";

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

export type MonthlyReportDailyTrend = {
  date: string;
  totalHours: number;
  metTarget: boolean;
};

export type MonthlyReportVisit = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

export type MonthlyReportSectionProps = {
  monthKey: string;
  timezone: string;
  hoursTarget: number;
  monthlyProgress: {
    qualifyingDays: number;
    officeVisitDays: number;
    daysInMonth: number;
    monthlyDaysTarget: number;
    progressState: MonthlyProgressState;
  };
  dailyTrend: MonthlyReportDailyTrend[];
  visits: MonthlyReportVisit[];
  pulse: {
    agentHealthy: boolean;
    pulsesLast24h: number;
    pulseTimeline24h?: number[];
    minutesSinceLastPulse?: number | null;
    lastHeartbeat?: string | null;
  };
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  agentHealthLabel?: string;
  agentHealthDetail?: string;
};

function progressStateToTone(state: MonthlyProgressState): KpiTone {
  if (state === "met") return "success";
  if (state === "on_track") return "warning";
  return "danger";
}

export function MonthlyReportSection({
  monthKey,
  timezone,
  hoursTarget,
  monthlyProgress,
  dailyTrend,
  visits,
  pulse,
  selectedDate,
  onSelectDate,
  agentHealthLabel,
  agentHealthDetail,
}: MonthlyReportSectionProps) {
  const chartData: DailyHoursPoint[] = useMemo(
    () =>
      dailyTrend.map((d) => ({
        date: d.date,
        totalHours: d.totalHours,
        metTarget: d.metTarget,
      })),
    [dailyTrend],
  );

  const totalHours = useMemo(
    () => dailyTrend.reduce((sum, day) => sum + day.totalHours, 0),
    [dailyTrend],
  );

  const progress = monthlyProgress;
  const monthlyTone = progressStateToTone(progress.progressState);
  const agentTone: KpiTone = pulse.agentHealthy ? "success" : "danger";
  const pulseTimeline = pulse.pulseTimeline24h ?? Array(24).fill(0);
  const agentLabel = agentHealthLabel ?? (pulse.agentHealthy ? "Healthy" : "Stale");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Days met target"
          value={`${progress.qualifyingDays} / ${progress.monthlyDaysTarget}`}
          tooltip={`Days this month with at least ${hoursTarget}h in office. Monthly goal is ${progress.monthlyDaysTarget} such days.`}
          tone={monthlyTone}
        />
        <KpiCard
          label="Office days"
          value={`${progress.officeVisitDays} / ${progress.daysInMonth}`}
          tooltip={`Days with any office visit or logged hours this month, even if below the ${hoursTarget}h daily target.`}
          tone="neutral"
        />
        <KpiCard
          label="Total office hours"
          value={formatHours(totalHours)}
          tooltip="Total office time across all days in the selected month. Each day runs from first check-in to last check-out."
          tone="neutral"
        />
        <KpiCard
          label="Agent health"
          value={agentLabel}
          tooltip={
            agentHealthDetail ??
            `Laptop agent syncs about every 5 minutes by default. Healthy means activity arrived within the configured grace window. ${pulse.pulsesLast24h} activity ticks in the last 24h.`
          }
          tone={agentTone}
        >
          <AgentPulseSparkline buckets={pulseTimeline} className="mt-2 h-8" />
          <p className="mt-1 text-[10px] text-muted">
            {pulse.pulsesLast24h} activity ticks · last 24h
            {pulse.minutesSinceLastPulse != null &&
              ` · ${formatPulseAge({
                minutes: pulse.minutesSinceLastPulse,
                lastPulseAt: pulse.lastHeartbeat,
                timezone,
              })}`}
          </p>
        </KpiCard>
      </div>

      <section className="card p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0">
            <HoursTrendChart
              data={chartData}
              targetHours={hoursTarget}
              title="Daily office hours"
              selectedDate={selectedDate}
              onBarClick={(date) => onSelectDate(selectedDate === date ? null : date)}
              height={220}
            />
            <p className="mt-2 text-[11px] text-muted">
              Orange bars meet the daily target. Amber bars are below target. Click a bar to filter
              visits.
            </p>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium">Office visit calendar</p>
            <VisitCalendar
              monthKey={monthKey}
              timezone={timezone}
              hoursTarget={hoursTarget}
              dailyTrend={dailyTrend}
              visits={visits}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              compact
            />
          </div>
        </div>

        {selectedDate && (
          <p className="mt-3 text-xs text-muted">
            Showing visits for <strong className="text-accent">{selectedDate}</strong>.{" "}
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="text-accent hover:underline"
            >
              Clear filter
            </button>
          </p>
        )}
      </section>
    </div>
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
    <div className={`card border p-3 ${KPI_BORDER_CLASSES[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted">{label}</p>
        <MetricHelp tooltip={tooltip} />
      </div>
      <p className={`mt-0.5 text-xl font-semibold ${KPI_TONE_CLASSES[tone]}`}>{value}</p>
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
