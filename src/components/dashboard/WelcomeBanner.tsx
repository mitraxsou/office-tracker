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
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
            {displayGreeting}
          </p>
          <p className="mt-0.5 text-sm text-muted">{displayStatus}</p>
        </div>
        <p className="shrink-0 self-start rounded-md border border-[var(--border)] bg-[var(--background-elevated)]/80 px-2.5 py-1 text-xs font-medium tabular-nums text-muted sm:self-center sm:text-sm">
          {qualifyingDays} / {monthlyDaysTarget} days this month
        </p>
      </div>
    </section>
  );
}
