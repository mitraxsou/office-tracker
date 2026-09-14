"use client";

import { useMemo } from "react";
import { calendarWeeksForMonth } from "@/lib/month-range";
import type { MonthlyProgressDay } from "@/lib/monthly-progress";
import { parseMonthKey } from "@/lib/month-range";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

type DeskClockCalendarProps = {
  monthKey: string;
  todayKey: string;
  monthDays: MonthlyProgressDay[];
};

export function DeskClockCalendar({ monthKey, todayKey, monthDays }: DeskClockCalendarProps) {
  const weeks = useMemo(() => calendarWeeksForMonth(monthKey, 1), [monthKey]);
  const dayMap = useMemo(
    () => new Map(monthDays.map((d) => [d.dayKey, d])),
    [monthDays],
  );
  const { year, month } = parseMonthKey(monthKey);
  const monthTitle = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));

  return (
    <div className="w-full max-w-[220px] shrink-0">
      <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted">
        {monthTitle}
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((label, i) => (
              <th key={i} className="pb-0.5 text-center font-medium text-muted">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((cell, ci) => {
                if (!cell.dayKey || cell.dayOfMonth === null) {
                  return <td key={ci} className="h-6 p-0" />;
                }
                const summary = dayMap.get(cell.dayKey);
                const isToday = cell.dayKey === todayKey;
                const hasHours = (summary?.hours ?? 0) > 0;
                const met = summary?.metTarget ?? false;

                return (
                  <td key={ci} className="h-6 p-0 text-center">
                    <div
                      className={`relative mx-auto flex h-5 w-5 flex-col items-center justify-center rounded-full text-[9px] font-medium ${
                        isToday ? "ring-2 ring-[var(--pwc-orange)]" : ""
                      }`}
                    >
                      {cell.dayOfMonth}
                      {hasHours && (
                        <span
                          className={`absolute -bottom-0.5 h-1 w-1 rounded-full ${
                            met ? "bg-green-400" : "bg-[var(--muted)]"
                          }`}
                          aria-hidden
                        />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
