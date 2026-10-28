"use client";

import { useMemo, useState, useEffect } from "react";
import {
  buildVisitDayGroups,
  type VisitDayGroupVisit,
  type VisitDayTrend,
} from "@/lib/visit-day-groups";
import {
  formatHours,
  formatTime,
  formatVisitDurationLabel,
  visitHasInvalidTimestamps,
} from "@/lib/visits";

type GroupedVisitListProps = {
  visits: VisitDayGroupVisit[];
  dailyTrend: VisitDayTrend[];
  timezone: string;
  hoursTarget: number;
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
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

export function GroupedVisitList({
  visits,
  dailyTrend,
  timezone,
  hoursTarget,
  selectedDate,
  onSelectDate,
}: GroupedVisitListProps) {
  const groups = useMemo(
    () =>
      buildVisitDayGroups(visits, dailyTrend, timezone, {
        selectedDate: selectedDate ?? null,
      }),
    [visits, dailyTrend, timezone, selectedDate],
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
      <p className="text-xs text-muted">
        {groups.length} day{groups.length === 1 ? "" : "s"} with office presence
        {selectedDate ? ` (filtered to ${selectedDate})` : ""}. Overnight visits
        that cross midnight appear on both calendar days.
      </p>
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
                {group.visits.length === 0 ? (
                  <p className="text-sm text-muted">
                    Hours counted from overnight presence with no separate visit start
                    this day.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {group.visits.map((visit) => {
                      const start = new Date(visit.startAt);
                      const end = visit.endAt ? new Date(visit.endAt) : null;
                      const row = { startAt: start, endAt: end };
                      const invalid = visitHasInvalidTimestamps(row);
                      const hoursLabel = formatVisitDurationLabel(row);

                      return (
                        <li
                          key={`${visit.id}-${visit.startAt}`}
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
                              {invalid ? " · end before start" : ""}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-medium ${invalid ? "text-red-400" : "text-muted"}`}
                          >
                            {hoursLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
