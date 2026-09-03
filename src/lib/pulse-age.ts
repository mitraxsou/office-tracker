type PulseAgeParams = {
  minutes: number | null | undefined;
  lastPulseAt?: string | Date | null;
  timezone?: string;
  now?: Date;
};

function dayKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function calendarDaysBetween(from: Date, to: Date, timezone: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.max(0, Math.round((toUtc(dayKey(to, timezone)) - toUtc(dayKey(from, timezone))) / 86_400_000));
}

function durationLabel(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (safeMinutes < 1) return "just now";
  if (safeMinutes < 60) return `${safeMinutes}m`;

  const days = Math.floor(safeMinutes / (24 * 60));
  const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
  const remainingMinutes = safeMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  return parts.join(" ");
}

export function formatPulseAge({
  minutes,
  lastPulseAt,
  timezone = "Asia/Kolkata",
  now = new Date(),
}: PulseAgeParams): string {
  if (minutes === null || minutes === undefined) return "Unknown";

  const duration = durationLabel(minutes);
  if (!lastPulseAt) return duration;

  const lastPulse = lastPulseAt instanceof Date ? lastPulseAt : new Date(lastPulseAt);
  if (Number.isNaN(lastPulse.getTime()) || calendarDaysBetween(lastPulse, now, timezone) < 1) {
    return duration;
  }

  const lastLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(lastPulse);
  return `${duration} · last ${lastLabel}`;
}
