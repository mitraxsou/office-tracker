import { describe, expect, it, vi } from "vitest";
import {
  normalizeCustomMessage,
  parseCustomNotifyChannel,
  sendCustomUserNotification,
} from "../src/lib/custom-notification";

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "Alex",
  timezone: "Asia/Kolkata",
};

describe("custom notification helpers", () => {
  it("accepts app, teams, and both", () => {
    expect(parseCustomNotifyChannel("app")).toBe("app");
    expect(parseCustomNotifyChannel("teams")).toBe("teams");
    expect(parseCustomNotifyChannel("both")).toBe("both");
    expect(parseCustomNotifyChannel("email")).toBeNull();
  });

  it("trims and rejects empty or oversized messages", () => {
    expect(normalizeCustomMessage("  Please update the agent.  ")).toBe(
      "Please update the agent.",
    );
    expect(normalizeCustomMessage("")).toBeNull();
    expect(normalizeCustomMessage("x".repeat(1001))).toBeNull();
  });
});

describe("sendCustomUserNotification", () => {
  it("posts only in-app when the admin chooses the app", async () => {
    const persistInApp = vi.fn().mockResolvedValue({ id: "n1" });
    const sendTeams = vi.fn();
    const result = await sendCustomUserNotification(user, "Please install the agent.", "app", {
      persistInApp,
      sendTeams,
      oooUrl: async () => "https://pulse.example/ooo",
      now: new Date("2026-09-04T10:00:00+05:30"),
    });
    expect(result).toEqual({ inApp: true, teams: { sent: false } });
    expect(persistInApp).toHaveBeenCalledOnce();
    expect(persistInApp.mock.calls[0][0]).toMatchObject({
      userId: "user-1",
      type: "custom",
      message: "Please install the agent.",
    });
    expect(sendTeams).not.toHaveBeenCalled();
  });

  it("sends only Teams when the admin chooses Teams", async () => {
    const persistInApp = vi.fn();
    const sendTeams = vi.fn().mockResolvedValue({ sent: true, skipped: false });
    const result = await sendCustomUserNotification(user, "Office day tomorrow.", "teams", {
      persistInApp,
      sendTeams,
      oooUrl: async () => "https://pulse.example/ooo",
      now: new Date("2026-09-04T10:00:00+05:30"),
    });
    expect(result).toEqual({ inApp: false, teams: { sent: true } });
    expect(persistInApp).not.toHaveBeenCalled();
    expect(sendTeams).toHaveBeenCalledOnce();
    expect(sendTeams.mock.calls[0][0]).toMatchObject({
      type: "custom",
      email: "user@example.com",
      notifyTeams: true,
      message: "Office day tomorrow.",
    });
  });

  it("sends both channels and reports a Teams failure", async () => {
    const persistInApp = vi.fn().mockResolvedValue({ id: "n1" });
    const sendTeams = vi.fn().mockResolvedValue({
      sent: false,
      skipped: true,
      reason: "not_configured",
    });
    const result = await sendCustomUserNotification(user, "Check Settings.", "both", {
      persistInApp,
      sendTeams,
      oooUrl: async () => "https://pulse.example/ooo",
    });
    expect(result.inApp).toBe(true);
    expect(result.teams).toEqual({ sent: false, reason: "not_configured" });
    expect(persistInApp).toHaveBeenCalledOnce();
    expect(sendTeams).toHaveBeenCalledOnce();
  });
});
