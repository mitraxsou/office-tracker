import { describe, expect, it } from "vitest";
import {
  buildAbsentMessage,
  buildBehindMessage,
  buildHoursMetMessage,
  buildHoursStartedMessage,
  buildOooClearedMessage,
  buildStaleMessage,
  classifyPresenceReminder,
  shouldQueueDailyAlert,
} from "../src/lib/integration-alerts";
import {
  DEFAULT_NOTIFICATION_PREFS,
  channelForAlert,
  deliversToApp,
  deliversToTeams,
  deliveryChannelFromFlags,
  deliveryFlagsFromChannel,
  getWeekdayInTimezone,
  isWorkDayNow,
  parseAlertDeliveryChannel,
  parseTimeToMinutes,
  toggleDeliveryChannel,
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
    expect(msg).toContain("update command");
    expect(msg).toContain("open PowerShell in that folder");
  });

  it("builds stale message with minutes", () => {
    const msg = buildStaleMessage(30, "https://pulse.example");
    expect(msg).toContain("30 minutes");
    expect(msg).toContain("https://pulse.example/settings#install");
    expect(msg).toContain("update command");
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

  it("builds out-of-office cleared message", () => {
    const msg = buildOooClearedMessage();
    expect(msg).toContain("out of office");
    expect(msg).toContain("cleared");
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

  it("queues hours_met from metTarget alone without requiring in-office heartbeats", () => {
    expect(shouldQueueDailyAlert(true, false)).toBe(true);
    expect(shouldQueueDailyAlert(false, false)).toBe(false);
  });
});

describe("alert delivery channels", () => {
  it("defaults reminder alerts to the app and hours alerts to app plus Teams", () => {
    expect(channelForAlert(DEFAULT_NOTIFICATION_PREFS, "absent")).toBe("app");
    expect(channelForAlert(DEFAULT_NOTIFICATION_PREFS, "stale")).toBe("app");
    expect(channelForAlert(DEFAULT_NOTIFICATION_PREFS, "behind")).toBe("app");
    expect(channelForAlert(DEFAULT_NOTIFICATION_PREFS, "hours_started")).toBe("both");
    expect(channelForAlert(DEFAULT_NOTIFICATION_PREFS, "ooo_cleared")).toBe("both");
    expect(channelForAlert(DEFAULT_NOTIFICATION_PREFS, "hours_met")).toBe("both");
    expect(DEFAULT_NOTIFICATION_PREFS.alertIfHoursStarted).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFS.alertIfHoursMet).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFS.alertIfNotInOffice).toBe(false);
    expect(DEFAULT_NOTIFICATION_PREFS.alertIfAgentStale).toBe(false);
  });

  it("rejects unknown channel values", () => {
    expect(parseAlertDeliveryChannel("email", "app")).toBe("app");
    expect(parseAlertDeliveryChannel("teams", "app")).toBe("teams");
    expect(parseAlertDeliveryChannel("both", "app")).toBe("both");
  });

  it("supports app, teams, or both delivery", () => {
    expect(deliveryFlagsFromChannel("app")).toEqual({ app: true, teams: false });
    expect(deliveryFlagsFromChannel("teams")).toEqual({ app: false, teams: true });
    expect(deliveryFlagsFromChannel("both")).toEqual({ app: true, teams: true });
    expect(deliversToApp("both")).toBe(true);
    expect(deliversToTeams("both")).toBe(true);
    expect(deliversToApp("teams")).toBe(false);
    expect(deliversToTeams("app")).toBe(false);
    expect(deliveryChannelFromFlags(true, true)).toBe("both");
    expect(toggleDeliveryChannel("app", "teams", true)).toBe("both");
    expect(toggleDeliveryChannel("both", "app", false)).toBe("teams");
    expect(toggleDeliveryChannel("teams", "teams", false)).toBe("teams");
  });
});
