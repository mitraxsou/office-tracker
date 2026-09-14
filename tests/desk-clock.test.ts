import { describe, expect, it } from "vitest";
import {
  analogHandAngles,
  clockPartsInTimezone,
  DEFAULT_DESK_CLOCK_SETTINGS,
  parseDeskClockSettings,
} from "@/lib/desk-clock";

describe("parseDeskClockSettings", () => {
  it("returns defaults for null", () => {
    expect(parseDeskClockSettings(null)).toEqual(DEFAULT_DESK_CLOCK_SETTINGS);
  });

  it("falls back per field on bad JSON", () => {
    expect(parseDeskClockSettings("not-json")).toEqual(DEFAULT_DESK_CLOCK_SETTINGS);
  });

  it("merges valid partial JSON", () => {
    expect(
      parseDeskClockSettings(JSON.stringify({ face: "analog", color: "orange", hour12: false })),
    ).toEqual({
      ...DEFAULT_DESK_CLOCK_SETTINGS,
      face: "analog",
      color: "orange",
      hour12: false,
    });
  });

  it("preserves saved LED face preference", () => {
    expect(parseDeskClockSettings(JSON.stringify({ face: "led" }))).toEqual({
      ...DEFAULT_DESK_CLOCK_SETTINGS,
      face: "led",
    });
  });

  it("ignores invalid enum values", () => {
    const parsed = parseDeskClockSettings(
      JSON.stringify({ face: "neon", color: "purple", hidden: true }),
    );
    expect(parsed.face).toBe("analog");
    expect(parsed.color).toBe("blue");
    expect(parsed.hidden).toBe(true);
  });
});

describe("clockPartsInTimezone", () => {
  const tz = "Asia/Kolkata";
  const date = new Date("2026-09-14T12:30:45+05:30");

  it("formats 12-hour clock with meridiem", () => {
    const parts = clockPartsInTimezone(date, tz, { hour12: true, showSeconds: true });
    expect(parts.hours).toBe("12");
    expect(parts.minutes).toBe("30");
    expect(parts.seconds).toBe("45");
    expect(parts.meridiem).toBe("PM");
    expect(parts.monthNumber).toBe("9");
    expect(parts.monthDay).toBe("14");
    expect(parts.year).toBe("2026");
  });

  it("formats 24-hour clock without meridiem", () => {
    const parts = clockPartsInTimezone(date, tz, { hour12: false, showSeconds: false });
    expect(parts.hours).toBe("12");
    expect(parts.minutes).toBe("30");
    expect(parts.meridiem).toBe("");
  });
});

describe("analogHandAngles", () => {
  it("points hands at noon", () => {
    const date = new Date("2026-01-15T12:00:00+05:30");
    const angles = analogHandAngles(date, "Asia/Kolkata");
    expect(angles.hour).toBe(0);
    expect(angles.minute).toBe(0);
    expect(angles.second).toBe(0);
  });

  it("advances minute hand at half past", () => {
    const date = new Date("2026-01-15T12:30:00+05:30");
    const angles = analogHandAngles(date, "Asia/Kolkata");
    expect(angles.minute).toBe(180);
    expect(angles.hour).toBe(15);
  });
});
