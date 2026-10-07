"use client";

import { formatHours, formatTime } from "@/lib/visits";
import { shiftDayKey, type SelectedDaySummary } from "@/lib/admin-user-report-date";

type Props = {
  summary: SelectedDaySummary;
  timezone: string;
  hoursTarget: number;
  todayKey: string;
  inOfficeNow: boolean;
  onSelectDate: (dayKey: string) => void;
  onCorrect: () => void;
};

export function AdminSelectedDayWorkspace({
  summary,
  timezone,
  hoursTarget,
  todayKey,
  inOfficeNow,
  onSelectDate,
  onCorrect,
}: Props) {
  const isToday = summary.dayKey === todayKey;
  const dayLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${summary.dayKey}T12:00:00`));

  const ghostHours =
    summary.visitCount === 0 && summary.totalHours === 0
      ? null
      : summary.visitCount === 0
        ? "Hours need a Visit row. Use Correct this day to add one."
        : null;

  return (
    <section
      id="day-details"
      className="card scroll-mt-20 space-y-4 border border-[var(--pwc-orange)]/25 p-4"
      aria-labelledby="day-details-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted">Day workspace</p>
          <h3 id="day-details-heading" className="text-lg font-medium text-accent">
            {dayLabel}
            {isToday ? (
              <span className="ml-2 rounded bg-[var(--pwc-orange-muted)] px-2 py-0.5 text-xs font-normal text-accent">
                Today
              </span>
            ) : null}
          </h3>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => onSelectDate(todayKey)}
            className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
            aria-pressed={isToday}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onSelectDate(shiftDayKey(summary.dayKey, -1))}
            className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
            aria-label="Previous day"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onSelectDate(shiftDayKey(summary.dayKey, 1))}
            className="btn-secondary min-h-11 px-3 py-1.5 text-xs"
            aria-label="Next day"
          >
            Next
          </button>
          <label className="text-sm">
            <span className="sr-only">Pick day</span>
            <input
              type="date"
              value={summary.dayKey}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="picker-input min-h-11 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={onCorrect}
            className="btn-primary min-h-11 w-full px-3 py-1.5 text-xs sm:ml-auto sm:w-auto"
          >
            Correct this day
          </button>
        </div>
      </div>

      {ghostHours ? (
        <p className="rounded-lg border border-[var(--pwc-orange)]/40 bg-[var(--pwc-orange-muted)]/40 px-3 py-2 text-sm">
          {ghostHours}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DayStat
          label="Office time"
          value={formatHours(summary.totalHours)}
          detail={`Target ${hoursTarget}h`}
        />
        <DayStat
          label="Target status"
          value={summary.metTarget ? "Met" : "Below target"}
          detail={
            summary.visitCount === 0
              ? "No visits logged"
              : `${summary.visitCount} visit${summary.visitCount === 1 ? "" : "s"}`
          }
          tone={summary.metTarget ? "success" : summary.visitCount > 0 ? "warning" : "muted"}
        />
        <DayStat
          label="First / last activity"
          value={
            summary.firstActivityAt
              ? formatTime(new Date(summary.firstActivityAt), timezone)
              : "-"
          }
          detail={
            summary.lastActivityAt
              ? `Last ${formatTime(new Date(summary.lastActivityAt), timezone)}${
                  summary.openVisit ? " (open)" : ""
                }`
              : "No activity"
          }
        />
        <DayStat
          label="In-office state"
          value={
            isToday
              ? inOfficeNow
                ? "In office now"
                : summary.openVisit
                  ? "Open visit"
                  : "Not in office"
              : summary.openVisit
                ? "Open visit"
                : summary.visitCount > 0
                  ? "Closed visits"
                  : "No visit"
          }
          detail={isToday ? "Based on latest agent signal" : "For the selected day"}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Visits on this day</h4>
          <button type="button" onClick={onCorrect} className="text-xs text-accent hover:underline">
            Add or edit visit
          </button>
        </div>
        {summary.visits.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              No visits on this day. Office hours stay at 0 until you add a Visit.
            </p>
            <button
              type="button"
              onClick={onCorrect}
              className="btn-primary min-h-11 w-full px-3 py-2 text-sm sm:w-auto"
            >
              Correct this day
            </button>
          </div>
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
                {summary.visits.map((visit) => {
                  const start = new Date(visit.startAt);
                  const end = visit.endAt ? new Date(visit.endAt) : null;
                  const durationH = end
                    ? (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                    : null;
                  return (
                    <tr key={visit.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">
                        {formatTime(start, timezone)}
                        {visit.startedPreviousDay ? (
                          <span className="mt-0.5 block text-[11px] text-accent">
                            Started previous day
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        {end ? formatTime(end, timezone) : <span className="text-accent">Open</span>}
                      </td>
                      <td className="py-2 pr-3">
                        {durationH == null ? "-" : formatHours(durationH)}
                      </td>
                      <td className="py-2 pr-3">{visit.source}</td>
                      <td className="py-2 font-mono text-xs">{visit.ssid ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sticky bottom-2 z-10 sm:hidden">
        <button
          type="button"
          onClick={onCorrect}
          className="btn-primary w-full min-h-11 px-3 py-2 text-sm shadow-lg"
        >
          Correct this day
        </button>
      </div>
    </section>
  );
}

function DayStat({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "muted";
}) {
  const valueClass =
    tone === "success"
      ? "text-green-400"
      : tone === "warning"
        ? "text-accent"
        : tone === "muted"
          ? "text-muted"
          : "";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{detail}</p>
    </div>
  );
}
