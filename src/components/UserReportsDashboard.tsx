"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GroupedVisitList } from "@/components/reports/GroupedVisitList";
import { ComplianceExportButton } from "@/components/reports/ComplianceExportButton";
import { MonthReportToolbar } from "@/components/reports/ReportToolbar";
import { MonthlyReportSection } from "@/components/reports/MonthlyReportSection";
import { currentMonthKey } from "@/lib/month-range";
import type { MonthlyProgressState } from "@/lib/monthly-progress";

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
    lastHeartbeat?: string | null;
  };
  range: { days: number; from: string; to: string; month: string };
};

export function UserReportsDashboard({
  fiscalYearStartMonth,
  fiscalYearEndMonth,
}: {
  fiscalYearStartMonth: number;
  fiscalYearEndMonth: number;
}) {
  const [monthKey, setMonthKey] = useState(() => currentMonthKey("Asia/Kolkata"));
  const [data, setData] = useState<UserReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visitFilter, setVisitFilter] = useState<"all" | "wifi" | "manual">("all");

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

  if (loading && !data) {
    return <p className="text-muted">Loading reports...</p>;
  }

  if (!data) {
    return <p className="text-red-400">Failed to load reports.</p>;
  }

  const target = data.hoursTarget ?? data.user.hoursTarget;
  const timezone = data.user.timezone;

  return (
    <div className="space-y-4">
      <MonthReportToolbar monthKey={monthKey} timezone={timezone} onMonthChange={setMonthKey}>
        <ComplianceExportButton
          hrefBase="/api/user/reports/export"
          monthKey={monthKey}
          timezone={timezone}
          label="Download compliance report"
          fiscalYearStartMonth={fiscalYearStartMonth}
          fiscalYearEndMonth={fiscalYearEndMonth}
        />
      </MonthReportToolbar>

      <MonthlyReportSection
        monthKey={monthKey}
        timezone={timezone}
        hoursTarget={target}
        monthlyProgress={data.monthlyProgress}
        dailyTrend={data.dailyTrend}
        visits={data.visits}
        pulse={data.pulse}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            {selectedDate ? `Visits on ${selectedDate}` : "Visits this month"}
          </h2>
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

      <p className="text-xs text-muted">
        Click a chart bar or calendar day to filter visits.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Back to today
        </Link>
      </p>
    </div>
  );
}
