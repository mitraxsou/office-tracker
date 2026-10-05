"use client";

import { useEffect, useState } from "react";
import { formatHoursHms, formatTime } from "@/lib/visits";
import { toneClass, type StatusTone } from "@/components/dashboard/DashboardMiniStat";

type DashboardHeroSummaryProps = {
  totalHours: number;
  confirmedHours: number;
  targetHours: number;
  metTarget: boolean;
  inOfficeNow: boolean;
  firstCheckIn: Date | string | null;
  dayKey: string;
  timezone: string;
  lastSyncedLabel: string;
  lastSyncedTone: StatusTone;
  lastOfficeActivityLabel: string;
  lastOfficeActivityTone: StatusTone;
  confirmedThroughLabel: string | null;
  openVisitStartAt: Date | string | null;
  openVisitSsid: string | null;
};

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function liveHoursNow(
  inOfficeNow: boolean,
  firstCheckIn: Date | null,
  confirmedHours: number,
  totalHours: number,
  now: Date,
): number {
  if (!inOfficeNow || !firstCheckIn) return totalHours;
  const fromFirst = Math.max(0, now.getTime() - firstCheckIn.getTime()) / (1000 * 60 * 60);
  return Math.max(confirmedHours, fromFirst, totalHours);
}

export function DashboardHeroSummary({
  totalHours,
  confirmedHours,
  targetHours,
  metTarget: _metTarget,
  inOfficeNow,
  firstCheckIn,
  dayKey,
  timezone,
  lastSyncedLabel,
  lastSyncedTone,
  lastOfficeActivityLabel,
  lastOfficeActivityTone,
  confirmedThroughLabel,
  openVisitStartAt,
  openVisitSsid,
}: DashboardHeroSummaryProps) {
  const firstIn = asDate(firstCheckIn);
  const openVisitStart = asDate(openVisitStartAt);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!inOfficeNow) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [inOfficeNow]);

  const liveHours = liveHoursNow(inOfficeNow, firstIn, confirmedHours, totalHours, now);
  const remaining = Math.max(0, targetHours - liveHours);
  const estimatedHours = Math.max(0, liveHours - confirmedHours);
  const confirmedPct = Math.min(100, (confirmedHours / targetHours) * 100);
  const estimatedPct = Math.min(100 - confirmedPct, (estimatedHours / targetHours) * 100);
  const showEstimate = inOfficeNow && estimatedHours > 1 / 3600;
  const liveMet = liveHours >= targetHours;

  return (
    <section className="card card-brand card-wash p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted sm:text-sm">Today&apos;s office time</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl">
            {formatHoursHms(liveHours)}
            <span className="text-base font-normal text-muted sm:text-lg">
              {" "}
              / {formatHoursHms(targetHours)}
            </span>
          </p>
          {showEstimate && (
            <p className="mt-1 text-xs text-muted">
              <span className="text-foreground">{formatHoursHms(confirmedHours)} confirmed</span>
              {" · "}
              <span className="text-[var(--pwc-yellow)]">
                {formatHoursHms(estimatedHours)} estimated
              </span>
              {" until the next agent sync"}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums sm:px-3 sm:text-sm ${liveMet ? "badge-met" : "badge-pending"}`}
        >
          {liveMet ? "Target met" : `${formatHoursHms(remaining)} left`}
        </span>
      </div>

      <div className="progress-track mt-3 flex h-2 overflow-hidden rounded-full sm:h-2.5">
        <div
          className={`h-full ${liveMet && !showEstimate ? "progress-fill-met" : "progress-fill"}`}
          style={{ width: `${confirmedPct}%` }}
        />
        {showEstimate && (
          <div className="h-full progress-fill-estimated" style={{ width: `${estimatedPct}%` }} />
        )}
      </div>

      {openVisitStart && (
        <p className="mt-3 text-xs text-muted">
          Open visit since{" "}
          <strong className="text-accent">{formatTime(openVisitStart, timezone)}</strong>
          {openVisitSsid ? ` on ${openVisitSsid}` : ""}
        </p>
      )}

      <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-xs text-muted">
        <p>
          Last synced:{" "}
          <span className={toneClass(lastSyncedTone)}>{lastSyncedLabel}</span>
        </p>
        <p>
          Last office activity:{" "}
          <span className={toneClass(lastOfficeActivityTone)}>{lastOfficeActivityLabel}</span>
        </p>
      </div>

      {confirmedThroughLabel && (
        <p className="mt-2 text-xs text-foreground">{confirmedThroughLabel}</p>
      )}

      <p className="mt-2 text-[11px] text-muted">
        {dayKey} · Orange is time confirmed by the agent. Yellow is estimated from first check-in
        while you still look in office. The day total is final after the last agent sync.
      </p>
    </section>
  );
}
