"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calendarWeeksForMonth } from "@/lib/month-range";
import { MonthReportToolbar } from "@/components/reports/ReportToolbar";

export type AdminOrgCalendarDay = {
  dayKey: string;
  attendedCount: number;
  metTargetCount: number;
  compliancePct: number;
  totalRegistered: number;
  excludedOoo: number;
  excludedStale: number;
  excludedNoVisit: number;
  totalAttendedHours: number;
  isWeekend: boolean;
};

type AdminOrgCalendarProps = {
  monthKey: string;
  timezone?: string;
  selectedDate: string | null;
  onMonthChange: (monthKey: string) => void;
  onSelectDate: (dayKey: string) => void;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayTone(day: AdminOrgCalendarDay | undefined): "green" | "orange" | "gray" {
  if (!day || day.attendedCount === 0) return "gray";
  if (day.metTargetCount === day.attendedCount) return "green";
  return "orange";
}

export function AdminOrgCalendar({
  monthKey,
  timezone = "Asia/Kolkata",
  selectedDate,
  onMonthChange,
  onSelectDate,
}: AdminOrgCalendarProps) {
  const [days, setDays] = useState<AdminOrgCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (month: string) => {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ month, timezone });
      const res = await fetch(`/api/admin/reports/calendar?${qs}`);
      setLoading(false);
      if (!res.ok) {
        setError("Failed to load org calendar");
        return;
      }
      const json = await res.json();
      setDays(json.days ?? []);
    },
    [timezone],
  );

  useEffect(() => {
    void load(monthKey);
  }, [monthKey, load]);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.dayKey, d])), [days]);
  const weeks = useMemo(() => calendarWeeksForMonth(monthKey, 1), [monthKey]);

  return (
    <div className="space-y-4">
      <MonthReportToolbar monthKey={monthKey} timezone={timezone} onMonthChange={onMonthChange}>
        {loading && <span className="text-xs text-muted">Loading calendar...</span>}
      </MonthReportToolbar>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((label) => (
                <th
                  key={label}
                  className="border-b border-[var(--border)] pb-2 text-center text-xs font-medium text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => {
                  if (!cell.dayKey) {
                    return (
                      <td
                        key={ci}
                        className="h-24 border border-[var(--border)] bg-[var(--background)]/50 p-1"
                      />
                    );
                  }

                  const day = dayMap.get(cell.dayKey);
                  const tone = dayTone(day);
                  const isSelected = selectedDate === cell.dayKey;
                  const attended = day?.attendedCount ?? 0;
                  const met = day?.metTargetCount ?? 0;

                  return (
                    <td key={ci} className="h-24 border border-[var(--border)] p-1 align-top">
                      <button
                        type="button"
                        onClick={() => onSelectDate(cell.dayKey!)}
                        className={`flex h-full w-full flex-col rounded-md p-1.5 text-left transition-colors ${
                          isSelected
                            ? "bg-[var(--pwc-orange)]/20 ring-2 ring-[var(--pwc-orange)]"
                            : tone === "green"
                              ? "bg-green-500/10 hover:bg-green-500/15"
                              : tone === "orange"
                                ? "bg-[var(--pwc-orange)]/5 hover:bg-[var(--pwc-orange)]/10"
                                : "hover:bg-[var(--border)]/40"
                        }`}
                      >
                        <span className="text-xs font-medium">{cell.dayOfMonth}</span>
                        {attended > 0 ? (
                          <>
                            <span
                              className={`mt-1 text-xs font-semibold ${
                                tone === "green" ? "text-green-400" : "text-accent"
                              }`}
                            >
                              {attended} visited
                            </span>
                            <span
                              className={`mt-auto text-[10px] ${
                                tone === "green" ? "text-green-400" : "text-muted"
                              }`}
                            >
                              {met}/{attended} met target
                            </span>
                          </>
                        ) : (
                          <span className="mt-1 text-[10px] text-muted">No visits</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Green = all attended users met the daily target. Orange = visits but some users below
        target. Gray = no office visits. Compliance counts attended users only; OOO and stale-agent
        users are excluded unless they logged office hours. Click a day for drill-down.
      </p>
    </div>
  );
}
