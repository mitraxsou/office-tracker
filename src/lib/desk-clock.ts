export const DESK_CLOCK_STORAGE_KEY = "office-pulse-desk-clock";

export type DeskClockFace = "led" | "analog";
export type DeskClockColor = "blue" | "orange" | "white" | "green";

export type DeskClockSettings = {
  face: DeskClockFace;
  color: DeskClockColor;
  hour12: boolean;
  showSeconds: boolean;
  showCalendar: boolean;
  hidden: boolean;
};

export const DEFAULT_DESK_CLOCK_SETTINGS: DeskClockSettings = {
  face: "led",
  color: "blue",
  hour12: true,
  showSeconds: true,
  showCalendar: true,
  hidden: false,
};

const FACES: DeskClockFace[] = ["led", "analog"];
const COLORS: DeskClockColor[] = ["blue", "orange", "white", "green"];

function isFace(value: unknown): value is DeskClockFace {
  return typeof value === "string" && FACES.includes(value as DeskClockFace);
}

function isColor(value: unknown): value is DeskClockColor {
  return typeof value === "string" && COLORS.includes(value as DeskClockColor);
}

export function parseDeskClockSettings(raw: string | null): DeskClockSettings {
  if (!raw) return { ...DEFAULT_DESK_CLOCK_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<DeskClockSettings>;
    return {
      face: isFace(parsed.face) ? parsed.face : DEFAULT_DESK_CLOCK_SETTINGS.face,
      color: isColor(parsed.color) ? parsed.color : DEFAULT_DESK_CLOCK_SETTINGS.color,
      hour12:
        typeof parsed.hour12 === "boolean" ? parsed.hour12 : DEFAULT_DESK_CLOCK_SETTINGS.hour12,
      showSeconds:
        typeof parsed.showSeconds === "boolean"
          ? parsed.showSeconds
          : DEFAULT_DESK_CLOCK_SETTINGS.showSeconds,
      showCalendar:
        typeof parsed.showCalendar === "boolean"
          ? parsed.showCalendar
          : DEFAULT_DESK_CLOCK_SETTINGS.showCalendar,
      hidden:
        typeof parsed.hidden === "boolean" ? parsed.hidden : DEFAULT_DESK_CLOCK_SETTINGS.hidden,
    };
  } catch {
    return { ...DEFAULT_DESK_CLOCK_SETTINGS };
  }
}

export function readDeskClockSettings(): DeskClockSettings {
  if (typeof window === "undefined") return { ...DEFAULT_DESK_CLOCK_SETTINGS };
  return parseDeskClockSettings(localStorage.getItem(DESK_CLOCK_STORAGE_KEY));
}

export function writeDeskClockSettings(settings: DeskClockSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DESK_CLOCK_STORAGE_KEY, JSON.stringify(settings));
}

export type ClockParts = {
  hours: string;
  minutes: string;
  seconds: string;
  meridiem: string;
  weekday: string;
  weekdayShort: string;
  monthDay: string;
  monthNumber: string;
  monthLabel: string;
  year: string;
  dateLabel: string;
};

export function clockPartsInTimezone(
  date: Date,
  timezone: string,
  options: { hour12: boolean; showSeconds: boolean },
): ClockParts {
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: options.showSeconds ? "2-digit" : undefined,
    hour12: options.hour12,
  }).formatToParts(date);

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).formatToParts(date);

  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  const second = timeParts.find((p) => p.type === "second")?.value ?? "00";
  const dayPeriod = timeParts.find((p) => p.type === "dayPeriod")?.value ?? "";

  const weekdayLong = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(date);
  const weekdayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
  }).format(date);
  const monthNumber = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "numeric",
  }).format(date);
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(date);
  const monthDay =
    dateParts.find((p) => p.type === "day")?.value ??
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric" }).format(date);

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

  return {
    hours: hour,
    minutes: minute,
    seconds: second,
    meridiem: dayPeriod.toUpperCase(),
    weekday: weekdayLong,
    weekdayShort,
    monthDay,
    monthNumber,
    monthLabel,
    year,
    dateLabel,
  };
}

export type AnalogHandAngles = {
  hour: number;
  minute: number;
  second: number;
};

function timePartsInTimezone(date: Date, timezone: string): {
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const second = Number(parts.find((p) => p.type === "second")?.value ?? 0);
  return { hour, minute, second };
}

/** SVG rotation: 0 deg = 12 o'clock, clockwise positive. */
export function analogHandAngles(date: Date, timezone: string): AnalogHandAngles {
  const { hour, minute, second } = timePartsInTimezone(date, timezone);
  const hour12 = hour % 12;
  const secondAngle = second * 6;
  const minuteAngle = minute * 6 + second * 0.1;
  const hourAngle = hour12 * 30 + minute * 0.5 + second * (0.5 / 60);
  return { hour: hourAngle, minute: minuteAngle, second: secondAngle };
}

export const DESK_CLOCK_COLOR_CSS: Record<DeskClockColor, string> = {
  blue: "#4fc3f7",
  orange: "#fd5108",
  white: "#f5f5f5",
  green: "#66bb6a",
};
