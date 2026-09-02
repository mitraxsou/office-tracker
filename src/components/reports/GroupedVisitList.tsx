"use client";

import { useMemo, useState, useEffect } from "react";
import { dayKeyInTimezone } from "@/lib/visits";
import { formatHours, formatTime } from "@/lib/visits";

type VisitRow = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

type DayTrend = {
  date: string;
  totalHours: number;
  metTarget: boolean;
};

type GroupedVisitListProps = {
  visits: VisitRow[];
  dailyTrend: DayTrend[];
  timezone: string;
  hoursTarget: number;
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
};

type DayGroup = {
  dayKey: string;
  visits: VisitRow[];
  totalHours: number;
  metTarget: boolean;
  firstIn: Date | null;
  lastOut: Date | null;
  hasOpenVisit: boolean;
};

function formatDayLabel(dayKey: string, timezone: string): string {
  const date = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function buildDayGroups(
  visits: VisitRow[],
  dailyTrend: DayTrend[],
  timezone: string,
): DayGroup[] {
  const trendByDate = new Map(dailyTrend.map((day) => [day.date, day]));
  const byDay = new Map<string, VisitRow[]>();

  for (const visit of visits) {
    const dayKey = dayKeyInTimezone(new Date(visit.startAt), timezone);
    const rows = byDay.get(dayKey) ?? [];
    rows.push(visit);
    byDay.set(dayKey, rows);
  }

  return Array.from(byDay.entries())
    .map(([dayKey, dayVisits]) => {
      const sorted = [...dayVisits].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      const firstIn = sorted[0] ? new Date(sorted[0].startAt) : null;
      const ends = sorted
        .map((visit) => (visit.endAt ? new Date(visit.endAt) : null))
        .filter((value): value is Date => value !== null);
      const hasOpenVisit = sorted.some((visit) => visit.endAt === null);
      const lastOut = ends.length > 0 ? new Date(Math.max(...ends.map((date) => date.getTime()))) : null;
      const trend = trendByDate.get(dayKey);

      return {
        dayKey,
        visits: sorted,
        totalHours: trend?.totalHours ?? 0,
        metTarget: trend?.metTarget ?? false,
        firstIn,
        lastOut,
        hasOpenVisit,
      };
    })
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

export function GroupedVisitList({
  visits,
  dailyTrend,
  timezone,
  hoursTarget,
  selectedDate,
  onSelectDate,
}: GroupedVisitListProps) {
  const groups = useMemo(
    () => buildDayGroups(visits, dailyTrend, timezone),
    [visits, dailyTrend, timezone],
  );
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() =>
    selectedDate ? new Set([selectedDate]) : new Set(),
  );

  useEffect(() => {
    if (selectedDate) {
      setExpandedDays((prev) => new Set(prev).add(selectedDate));
    }
  }, [selectedDate]);

  if (groups.length === 0) {
    return <p className="text-sm text-muted">No visits in this month.</p>;
  }

  function toggleDay(dayKey: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
    onSelectDate?.(selectedDate === dayKey ? null : dayKey);
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const expanded = expandedDays.has(group.dayKey) || selectedDate === group.dayKey;
        const isSelected = selectedDate === group.dayKey;

        return (
          <div
            key={group.dayKey}
            className={`overflow-hidden rounded-lg border transition-colors ${
              isSelected
                ? "border-[var(--pwc-orange)]/50 bg-[var(--pwc-orange-muted)]/30"
                : "border-[var(--border)]"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleDay(group.dayKey)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-[var(--background-elevated)]/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{formatDayLabel(group.dayKey, timezone)}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      group.metTarget
                        ? "bg-green-500/15 text-green-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {group.metTarget ? "Target met" : `Below ${hoursTarget}h`}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {group.firstIn ? formatTime(group.firstIn, timezone) : "-"}
                  {" - "}
                  {group.hasOpenVisit
                    ? "now"
                    : group.lastOut
                      ? formatTime(group.lastOut, timezone)
                      : "-"}
                  {" · "}
                  {group.visits.length} visit{group.visits.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-lg font-semibold text-[var(--pwc-orange)]">
                  {formatHours(group.totalHours)}
                </span>
                <span className="text-xs text-muted">{expanded ? "Hide" : "Show"} segments</span>
              </div>
            </button>

            {expanded && (
              <div className="border-t border-[var(--border)] bg-[var(--background)]/50 px-4 py-3">
                <ul className="space-y-2">
                  {group.visits.map((visit) => {
                    const start = new Date(visit.startAt);
                    const end = visit.endAt ? new Date(visit.endAt) : null;
                    const durationMs = end
                      ? Math.max(0, end.getTime() - start.getTime())
                      : Math.max(0, Date.now() - start.getTime());
                    const hours = durationMs / (1000 * 60 * 60);

                    return (
                      <li
                        key={visit.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {formatTime(start, timezone)} -{" "}
                            {end ? formatTime(end, timezone) : "open"}
                          </p>
                          <p className="text-xs text-muted">
                            {visit.source === "manual" ? "Manual" : "Wi-Fi"}
                            {visit.ssid ? ` · ${visit.ssid}` : ""}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-muted">{formatHours(hours)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
