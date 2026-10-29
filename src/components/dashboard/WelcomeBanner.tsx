"use client";

import { useEffect, useMemo, useState } from "react";
import {
  greetingPeriodForHour,
  hourInTimezone,
  welcomeGreetingForDate,
  welcomeStatusLine,
  type WelcomeStatusInput,
} from "@/lib/welcome-greeting";
import {
  dayCountsAsVisited,
  describeMonthlyDayJourney,
} from "@/lib/monthly-progress";

type WelcomeBannerProps = {
  firstName: string;
  timezone: string;
  initialGreeting: string;
  initialStatus: string;
  statusInput: Omit<WelcomeStatusInput, "period">;
  qualifyingDays: number;
  monthlyDaysTarget: number;
  todayMetTarget: boolean;
};

/**
 * Accent-washed welcome strip above the Today card.
 * Uses server-computed initial text to avoid hydration mismatch, then
 * re-derives after mount on a 60s interval.
 */
export function WelcomeBanner({
  firstName,
  timezone,
  initialGreeting,
  initialStatus,
  statusInput,
  qualifyingDays,
  monthlyDaysTarget,
  todayMetTarget,
}: WelcomeBannerProps) {
  const [greeting, setGreeting] = useState(initialGreeting);
  const [status, setStatus] = useState(initialStatus);
  const [mounted, setMounted] = useState(false);

  const {
    totalHours,
    targetHours,
    metTarget,
    inOfficeNow,
    outOfOfficeToday,
  } = statusInput;

  useEffect(() => {
    setMounted(true);
    const refresh = () => {
      const now = new Date();
      setGreeting(welcomeGreetingForDate(now, timezone, firstName));
      const period = greetingPeriodForHour(hourInTimezone(now, timezone));
      setStatus(
        welcomeStatusLine({
          period,
          totalHours,
          targetHours,
          metTarget,
          inOfficeNow,
          outOfOfficeToday,
        }),
      );
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [
    firstName,
    timezone,
    totalHours,
    targetHours,
    metTarget,
    inOfficeNow,
    outOfOfficeToday,
  ]);

  const journey = useMemo(
    () =>
      describeMonthlyDayJourney({
        qualifyingDays,
        monthlyDaysTarget,
        todayMetTarget,
        inOfficeNow,
        todayHasOfficeTime: dayCountsAsVisited(totalHours),
      }),
    [
      qualifyingDays,
      monthlyDaysTarget,
      todayMetTarget,
      inOfficeNow,
      totalHours,
    ],
  );

  const displayGreeting = mounted ? greeting : initialGreeting;
  const displayStatus = mounted ? status : initialStatus;
  const slotCount = Math.min(31, Math.max(1, journey.monthlyDaysTarget));

  return (
    <section
      className="card card-brand card-wash relative overflow-hidden p-0"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
            {displayGreeting}
          </p>
          <p className="mt-0.5 text-sm text-muted">{displayStatus}</p>
          {journey.ongoingLabel ? (
            <p className="mt-1.5 text-sm font-medium text-accent">
              {journey.ongoingLabel}
              <span className="font-normal text-muted">
                {" "}
                · covering today toward {journey.monthlyDaysTarget} days
              </span>
            </p>
          ) : null}
        </div>

        <div className="shrink-0 self-stretch sm:min-w-[12.5rem] sm:self-center">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background-elevated)]/80 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium tabular-nums text-muted">
                <span className="text-sm text-[var(--foreground)]">
                  {journey.qualifyingDays}
                </span>
                {" / "}
                {journey.monthlyDaysTarget} days
              </p>
              <p
                className={`text-[11px] font-medium ${
                  journey.monthTargetMet ? "text-[var(--success)]" : "text-accent"
                }`}
              >
                {journey.daysToGoLabel}
              </p>
            </div>

            <div
              className="month-day-track mt-2"
              style={{ ["--month-day-count" as string]: String(slotCount) }}
              role="img"
              aria-label={`${journey.qualifyingDays} of ${journey.monthlyDaysTarget} office days complete. ${journey.daysToGoLabel}.${
                journey.ongoingLabel ? ` ${journey.ongoingLabel}.` : ""
              }`}
            >
              {Array.from({ length: slotCount }, (_, index) => {
                const dayNumber = index + 1;
                const done = dayNumber <= journey.qualifyingDays;
                const ongoing =
                  journey.ongoingDayNumber === dayNumber &&
                  !journey.todayAlreadyQualified;
                const securedToday =
                  journey.todayAlreadyQualified &&
                  journey.ongoingDayNumber === dayNumber;
                return (
                  <span
                    key={dayNumber}
                    className={[
                      "month-day-dot",
                      done || securedToday ? "month-day-dot--done" : "",
                      ongoing ? "month-day-dot--ongoing" : "",
                      !done && !ongoing && !securedToday
                        ? "month-day-dot--todo"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={
                      ongoing
                        ? `${dayNumber}: ongoing today`
                        : securedToday
                          ? `${dayNumber}: secured today`
                          : done
                            ? `${dayNumber}: complete`
                            : `${dayNumber}: still to go`
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
