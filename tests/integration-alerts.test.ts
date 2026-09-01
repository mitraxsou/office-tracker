import { describe, expect, it } from "vitest";
import {
  buildAbsentMessage,
  buildBehindMessage,
  buildStaleMessage,
} from "../src/lib/integration-alerts";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getWeekdayInTimezone,
  isWorkDayNow,
  parseTimeToMinutes,
} from "../src/lib/notification-prefs";

describe("notification-prefs time helpers", () => {
  it("parses HH:mm to minutes", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(parseTimeToMinutes("15:00")).toBe(900);
  });

  it("detects work days in timezone", () => {
    const monday = new Date("2026-09-07T10:00:00+05:30");
    expect(getWeekdayInTimezone(monday, "Asia/Kolkata")).toBe(1);
    expect(isWorkDayNow(DEFAULT_NOTIFICATION_PREFS, monday, "Asia/Kolkata")).toBe(true);
  });

  it("excludes weekends from default work days", () => {
    const sunday = new Date("2026-09-06T10:00:00+05:30");
    expect(isWorkDayNow(DEFAULT_NOTIFICATION_PREFS, sunday, "Asia/Kolkata")).toBe(false);
  });
});

describe("integration alert messages", () => {
  it("builds absent message with start time", () => {
    const msg = buildAbsentMessage(DEFAULT_NOTIFICATION_PREFS);
    expect(msg).toContain("09:30");
    expect(msg).toContain("office Wi-Fi");
  });

  it("builds stale message with minutes", () => {
    expect(buildStaleMessage(30)).toContain("30 minutes");
  });

  it("builds behind-hours message", () => {
    const msg = buildBehindMessage(1.5, 2.5, 5);
    expect(msg).toContain("1.5h");
    expect(msg).toContain("2.5h");
  });
});
