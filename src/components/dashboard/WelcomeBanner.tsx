"use client";

import { useEffect, useState } from "react";
import {
  greetingPeriodForHour,
  hourInTimezone,
  welcomeGreetingForDate,
  welcomeStatusLine,
  type WelcomeStatusInput,
} from "@/lib/welcome-greeting";

type WelcomeBannerProps = {
  firstName: string;
  timezone: string;
  initialGreeting: string;
  initialStatus: string;
  statusInput: Omit<WelcomeStatusInput, "period">;
  qualifyingDays: number;
  monthlyDaysTarget: number;
};

function GreetingStarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      <path d="M8 0.9c.35 0 .64.25.7.59l.55 3.05 2.7-1.56a.72.72 0 0 1 .98.26c.2.34.08.77-.26.97L9.97 5.86l1.56 2.7a.72.72 0 0 1-.26.98.72.72 0 0 1-.97-.26L8.74 7.58l-.55 3.05a.72.72 0 0 1-1.41.12l-.55-3.05-2.7 1.56a.72.72 0 0 1-.98-.26.72.72 0 0 1 .26-.97l2.7-1.56-1.56-2.7a.72.72 0 0 1 .26-.98.72.72 0 0 1 .97.26l1.56 2.7.55-3.05A.72.72 0 0 1 8 .9z" />
    </svg>
  );
}

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

  const displayGreeting = mounted ? greeting : initialGreeting;
  const displayStatus = mounted ? status : initialStatus;

  return (
    <section
      className="card relative overflow-hidden border-l-4 border-l-[var(--pwc-orange)] p-0"
      style={{
        background: `linear-gradient(105deg, var(--pwc-orange-muted) 0%, transparent 55%)`,
      }}
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--pwc-orange-muted)] text-[var(--pwc-orange)]"
            aria-hidden
          >
            <GreetingStarIcon />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
              {displayGreeting}
            </p>
            <p className="mt-0.5 text-sm text-muted">{displayStatus}</p>
          </div>
        </div>
        <p className="shrink-0 self-start rounded-md border border-[var(--border)] bg-[var(--background-elevated)]/80 px-2.5 py-1 text-xs font-medium tabular-nums text-muted sm:self-center sm:text-sm">
          {qualifyingDays} / {monthlyDaysTarget} days this month
        </p>
      </div>
    </section>
  );
}
