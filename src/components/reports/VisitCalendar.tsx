"use client";

import { useMemo } from "react";
import {
  calendarWeeksForMonth,
  dailyTrendMap,
} from "@/lib/month-range";
import { dayBoundsFromKey } from "@/lib/timezone-dates";
import { formatHours, formatTime, roundHours, visitsForDay, type VisitPoint } from "@/lib/visits";

export type VisitCalendarDay = {
  date: string;
  totalHours: number;
  metTarget: boolean;
};

export type VisitCalendarVisit = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

type VisitCalendarProps = {
  monthKey: string;
  timezone: string;
  hoursTarget: number;
  dailyTrend: VisitCalendarDay[];
  visits: VisitCalendarVisit[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  compact?: boolean;
  /** When false, clicking the selected day keeps it selected instead of clearing. */
  allowDeselect?: boolean;
  /** Hide the inline day detail panel (useful when a parent owns the day workspace). */
  showInlineDayDetail?: boolean;
  /** YYYY-MM-DD for "today" styling in the user's timezone. */
  todayKey?: string | null;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toVisitPoints(visits: VisitCalendarVisit[]): VisitPoint[] {
  return visits.map((v) => ({
    id: v.id,
    startAt: new Date(v.startAt),
    endAt: v.endAt ? new Date(v.endAt) : null,
    source: v.source,
    ssid: v.ssid,
  }));
}

export function VisitCalendar({
  monthKey,
  timezone,
  hoursTarget,
  dailyTrend,
  visits,
  selectedDate,
  onSelectDate,
  compact = false,
  allowDeselect = true,
  showInlineDayDetail = true,
  todayKey = null,
}: VisitCalendarProps) {
  const cellHeight = compact ? "h-14" : "h-20";
  const emptyCellHeight = compact ? "h-14" : "h-20";
  const trendByDate = useMemo(() => dailyTrendMap(dailyTrend), [dailyTrend]);
  const weeks = useMemo(() => calendarWeeksForMonth(monthKey, 1), [monthKey]);
  const visitPoints = useMemo(() => toVisitPoints(visits), [visits]);

  const selectedVisits = useMemo(() => {
    if (!selectedDate) return [];
    const { start } = dayBoundsFromKey(selectedDate, timezone);
    return visitsForDay(visitPoints, start, timezone);
  }, [selectedDate, visitPoints, timezone]);

  const selectedSummary = selectedDate ? trendByDate.get(selectedDate) : null;

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((label) => (
                <th
                  key={label}
                  className={`border-b border-[var(--border)] text-center font-medium text-muted ${compact ? "pb-1 text-[10px]" : "pb-2 text-xs"}`}
                >
                  {compact ? label.slice(0, 1) : label}
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
                        className={`${emptyCellHeight} border border-[var(--border)] bg-[var(--background)]/50 p-0.5`}
                      />
                    );
                  }

                  const summary = trendByDate.get(cell.dayKey);
                  const hours = summary?.totalHours ?? 0;
                  const met = summary?.metTarget ?? false;
                  const isSelected = selectedDate === cell.dayKey;
                  const isToday = todayKey === cell.dayKey;
                  const hasVisits = hours > 0;

                  return (
                    <td key={ci} className={`${cellHeight} border border-[var(--border)] p-0.5 align-top`}>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectDate(isSelected && allowDeselect ? null : cell.dayKey)
                        }
                        aria-pressed={isSelected}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${cell.dayKey}${hasVisits ? `, ${roundHours(hours)} hours` : ", no visits"}${met ? ", target met" : ""}${isToday ? ", today" : ""}${isSelected ? ", selected" : ""}`}
                        className={`flex h-full w-full flex-col rounded-md text-left transition-colors ${compact ? "p-1" : "p-1.5"} ${
                          isSelected
                            ? "bg-[var(--pwc-orange)]/20 ring-2 ring-[var(--pwc-orange)]"
                            : hasVisits
                              ? met
                                ? "bg-green-500/10 hover:bg-green-500/15"
                                : "bg-[var(--pwc-orange)]/5 hover:bg-[var(--pwc-orange)]/10"
                              : "hover:bg-[var(--border)]/40"
                        } ${isToday && !isSelected ? "ring-1 ring-[var(--pwc-orange)]/50" : ""}`}
                      >
                        <span
                          className={`${compact ? "text-[10px] font-medium" : "text-xs font-medium"} ${
                            isToday ? "text-accent" : ""
                          }`}
                        >
                          {cell.dayOfMonth}
                        </span>
                        {hasVisits ? (
                          <>
                            <span
                              className={`font-semibold ${compact ? "text-[10px]" : "mt-1 text-xs"} ${
                                met ? "text-green-400" : "text-accent"
                              }`}
                            >
                              {roundHours(hours)}h
                            </span>
                            {!compact && (
                              <span
                                className={`mt-auto text-[10px] ${
                                  met ? "text-green-400" : "text-muted"
                                }`}
                              >
                                {met ? "Target met" : `Below ${hoursTarget}h`}
                              </span>
                            )}
                          </>
                        ) : (
                          !compact && <span className="mt-1 text-[10px] text-muted">No visits</span>
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

      {!compact && (
        <p className="text-xs text-muted">
          Green = daily target met ({hoursTarget}h). Orange tint = visits but below target. Daily
          total is first check-in to last check-out (gaps count). Last in-office activity counts as
          checkout unless you checked out manually. Click a day for visit details.
        </p>
      )}

      {showInlineDayDetail && selectedDate && (
        <VisitDayDetail
          dayKey={selectedDate}
          timezone={timezone}
          totalHours={selectedSummary?.totalHours ?? 0}
          metTarget={selectedSummary?.metTarget ?? false}
          hoursTarget={hoursTarget}
          visits={selectedVisits}
          onClose={() => onSelectDate(null)}
        />
      )}
    </div>
  );
}

function VisitDayDetail({
  dayKey,
  timezone,
  totalHours,
  metTarget,
  hoursTarget,
  visits,
  onClose,
}: {
  dayKey: string;
  timezone: string;
  totalHours: number;
  metTarget: boolean;
  hoursTarget: number;
  visits: VisitPoint[];
  onClose: () => void;
}) {
  const dayLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dayKey}T12:00:00`));

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-accent">{dayLabel}</h3>
          <p className="mt-1 text-sm text-muted">
            Total: {formatHours(totalHours)} / {hoursTarget}h target (first check-in to last check-out)
            {" · "}
            <span className={metTarget ? "text-green-400" : "text-accent"}>
              {metTarget ? "Target met" : "Below target"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-accent hover:underline"
        >
          Close
        </button>
      </div>

      {visits.length === 0 ? (
        <p className="text-sm text-muted">No visits on this day.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                <th className="py-2 pr-3">Start</th>
                <th className="py-2 pr-3">End</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2">SSID</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const end = v.endAt ?? new Date();
                const durationH = (end.getTime() - v.startAt.getTime()) / (1000 * 60 * 60);
                return (
                  <tr key={v.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3">{formatTime(v.startAt, timezone)}</td>
                    <td className="py-2 pr-3">
                      {v.endAt ? formatTime(v.endAt, timezone) : "open"}
                    </td>
                    <td className="py-2 pr-3">{formatHours(durationH)}</td>
                    <td className="py-2 pr-3">{v.source}</td>
                    <td className="py-2">{v.ssid ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
