/**
 * Casual time-of-day welcome greeting for the Today dashboard.
 * Hour buckets use the user's IANA timezone, not server local time.
 */

export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night_owl";

/** Morning 5-11, afternoon 12-16, evening 17-21, night owl 22-4. */
export function greetingPeriodForHour(hour: number): GreetingPeriod {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h >= 5 && h <= 11) return "morning";
  if (h >= 12 && h <= 16) return "afternoon";
  if (h >= 17 && h <= 21) return "evening";
  return "night_owl";
}

export function greetingPhraseForPeriod(period: GreetingPeriod): string {
  switch (period) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    case "night_owl":
      return "Hello Night owl";
  }
}

/** Wall-clock hour (0-23) in an IANA timezone. */
export function hourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const raw = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  if (raw === 24) return 0;
  return Number.isFinite(raw) ? raw : 0;
}

function titleCaseToken(token: string): string {
  const cleaned = token.replace(/[^a-zA-Z'-]/g, "");
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/**
 * First name for greetings: first token of profile name, else email local-part.
 */
export function firstNameFromSession(
  name: string | null | undefined,
  email: string,
): string {
  const trimmed = name?.trim() ?? "";
  if (trimmed && !trimmed.includes("@") && trimmed.toLowerCase() !== email.trim().toLowerCase()) {
    const first = trimmed.split(/\s+/).find(Boolean);
    const titled = first ? titleCaseToken(first) : "";
    if (titled) return titled;
  }

  if (trimmed && !trimmed.includes("@")) {
    const titled = titleCaseToken(trimmed.split(/\s+/)[0] ?? trimmed);
    if (titled) return titled;
  }

  const local = (email.split("@")[0] ?? "").trim();
  const segment = local.split(/[._+-]/).find(Boolean) ?? local;
  const titled = titleCaseToken(segment);
  return titled || "there";
}

export function formatWelcomeGreeting(period: GreetingPeriod, firstName: string): string {
  const phrase = greetingPhraseForPeriod(period);
  const name = firstName.trim() || "there";
  return `${phrase}, ${name}`;
}

export function welcomeGreetingForDate(
  date: Date,
  timezone: string,
  firstName: string,
): string {
  const period = greetingPeriodForHour(hourInTimezone(date, timezone));
  return formatWelcomeGreeting(period, firstName);
}

export type WelcomeStatusInput = {
  period: GreetingPeriod;
  totalHours: number;
  targetHours: number;
  metTarget: boolean;
  inOfficeNow: boolean;
  outOfOfficeToday: boolean;
};

function formatStatusHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

/**
 * Casual status line under the time-of-day greeting.
 * Deterministic (no randomness) so SSR and client stay in sync.
 */
export function welcomeStatusLine(input: WelcomeStatusInput): string {
  const {
    period,
    totalHours,
    targetHours,
    metTarget,
    inOfficeNow,
    outOfOfficeToday,
  } = input;
  const remaining = Math.max(0, targetHours - totalHours);
  const nightOwl = period === "night_owl";

  if (outOfOfficeToday) {
    return "Marked out of office today.";
  }

  if (metTarget) {
    if (nightOwl) {
      return "Still going. Target met.";
    }
    return `${formatStatusHours(totalHours)} logged today. Target met.`;
  }

  if (totalHours <= 0) {
    return "No office time logged yet today.";
  }

  if (inOfficeNow) {
    if (nightOwl) {
      return `Still going. ${formatStatusHours(remaining)} to go.`;
    }
    return `${formatStatusHours(totalHours)} so far. ${formatStatusHours(remaining)} to go.`;
  }

  if (nightOwl) {
    return `Still going. ${formatStatusHours(remaining)} short.`;
  }
  return `${formatStatusHours(totalHours)} logged today. ${formatStatusHours(remaining)} short.`;
}
