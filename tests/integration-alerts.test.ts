import { describe, expect, it } from "vitest";
import {
  buildAbsentMessage,
  buildBehindMessage,
  buildHoursMetMessage,
  buildHoursStartedMessage,
  buildStaleMessage,
  classifyPresenceReminder,
  shouldQueueDailyAlert,
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

  it("defaults usual office days to Wednesday and Friday", () => {
    const monday = new Date("2026-09-07T10:00:00+05:30");
    const wednesday = new Date("2026-09-09T10:00:00+05:30");
    const friday = new Date("2026-09-11T10:00:00+05:30");
    expect(getWeekdayInTimezone(monday, "Asia/Kolkata")).toBe(1);
    expect(isWorkDayNow(DEFAULT_NOTIFICATION_PREFS, monday, "Asia/Kolkata")).toBe(false);
    expect(isWorkDayNow(DEFAULT_NOTIFICATION_PREFS, wednesday, "Asia/Kolkata")).toBe(true);
    expect(isWorkDayNow(DEFAULT_NOTIFICATION_PREFS, friday, "Asia/Kolkata")).toBe(true);
  });

  it("excludes weekends from default work days", () => {
    const sunday = new Date("2026-09-06T10:00:00+05:30");
    expect(isWorkDayNow(DEFAULT_NOTIFICATION_PREFS, sunday, "Asia/Kolkata")).toBe(false);
  });
});

describe("integration alert messages", () => {
  it("builds absent message with start time", () => {
    const msg = buildAbsentMessage(DEFAULT_NOTIFICATION_PREFS, "https://pulse.example");
    expect(msg).toContain("09:30");
    expect(msg).toContain("https://pulse.example/settings#install");
    expect(msg).toContain("https://pulse.example/help#install-agent");
  });

  it("builds stale message with minutes", () => {
    const msg = buildStaleMessage(30, "https://pulse.example");
    expect(msg).toContain("30 minutes");
    expect(msg).toContain("https://pulse.example/settings#install");
  });

  it("builds behind-hours message", () => {
    const msg = buildBehindMessage(1.5, 2.5, 5);
    expect(msg).toContain("1.5h");
    expect(msg).toContain("2.5h");
  });

  it("builds positive hours messages", () => {
    expect(buildHoursStartedMessage(5)).toContain("started");
    expect(buildHoursMetMessage(5.1, 5)).toContain("completed");
  });
});

describe("presence reminder rules", () => {
  it("treats a recent unknown SSID as working from home", () => {
    expect(
      classifyPresenceReminder({
        inOfficeToday: false,
        inOfficeNow: false,
        agentHealthy: true,
        lastSsid: "Home-WiFi",
      }),
    ).toBeNull();
  });

  it("allows an absent reminder when a healthy agent has no SSID", () => {
    expect(
      classifyPresenceReminder({
        inOfficeToday: false,
        inOfficeNow: false,
        agentHealthy: true,
        lastSsid: null,
      }),
    ).toBe("absent");
  });

  it("allows a stale reminder when the agent is not responding", () => {
    expect(
      classifyPresenceReminder({
        inOfficeToday: false,
        inOfficeNow: false,
        agentHealthy: false,
        lastSsid: "Home-WiFi",
      }),
    ).toBe("stale");
  });

  it("does not queue daily positive alerts after acknowledgement", () => {
    expect(shouldQueueDailyAlert(true, false)).toBe(true);
    expect(shouldQueueDailyAlert(true, true)).toBe(false);
    expect(shouldQueueDailyAlert(false, false)).toBe(false);
  });
});
