"use client";

import { useEffect, useState } from "react";
import { welcomeGreetingForDate } from "@/lib/welcome-greeting";

type WelcomeGreetingProps = {
  firstName: string;
  timezone: string;
};

function GreetingStarIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="shrink-0 text-accent"
    >
      <path d="M8 0.9c.35 0 .64.25.7.59l.55 3.05 2.7-1.56a.72.72 0 0 1 .98.26c.2.34.08.77-.26.97L9.97 5.86l1.56 2.7a.72.72 0 0 1-.26.98.72.72 0 0 1-.97-.26L8.74 7.58l-.55 3.05a.72.72 0 0 1-1.41.12l-.55-3.05-2.7 1.56a.72.72 0 0 1-.98-.26.72.72 0 0 1 .26-.97l2.7-1.56-1.56-2.7a.72.72 0 0 1 .26-.98.72.72 0 0 1 .97.26l1.56 2.7.55-3.05A.72.72 0 0 1 8 .9z" />
    </svg>
  );
}

/**
 * Compact time-of-day greeting line for the Today hero.
 * Uses the user's timezone so buckets match desk-clock wall time.
 */
export function WelcomeGreeting({ firstName, timezone }: WelcomeGreetingProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const text = welcomeGreetingForDate(now, timezone, firstName);

  return (
    <p
      className="flex items-center gap-2 px-4 pt-3 text-[15px] leading-snug text-[var(--foreground)] sm:text-base"
      aria-live="polite"
    >
      <GreetingStarIcon />
      <span className="font-medium tracking-tight">{text}</span>
    </p>
  );
}
