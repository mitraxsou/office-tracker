import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildAgentSyncBody,
  buildSimulatorSyncEvents,
  isDevSimulatorEnabled,
  isRemoteApiMode,
  officeSsidOptions,
} from "../src/lib/dev-simulator";

describe("isDevSimulatorEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is enabled in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    delete process.env.DEV_SIMULATOR_ENABLED;
    expect(isDevSimulatorEnabled()).toBe(true);
  });

  it("is disabled on Vercel production", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    expect(isDevSimulatorEnabled()).toBe(false);
  });

  it("can be forced with DEV_SIMULATOR_ENABLED", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.DEV_SIMULATOR_ENABLED = "1";
    expect(isDevSimulatorEnabled()).toBe(true);
  });
});

describe("buildSimulatorSyncEvents", () => {
  it("builds office arrival with visit start", () => {
    const result = buildSimulatorSyncEvents({ scenario: "office_arrival" });
    expect(result.events.map((event) => event.type)).toEqual(["ssid_changed", "visit_start"]);
    expect(result.openVisit?.localVisitId).toBeTruthy();
    expect(result.openVisit?.ssid).toBe("OfficeConnect");
  });

  it("builds office departure and clears open visit", () => {
    const openVisit = {
      localVisitId: "visit-123",
      startAt: "2026-09-12T04:00:00.000Z",
      ssid: "OfficeConnect",
    };
    const result = buildSimulatorSyncEvents({
      scenario: "office_departure",
      openVisit,
    });
    expect(result.events.some((event) => event.type === "visit_end")).toBe(true);
    expect(result.openVisit).toBeNull();
  });

  it("builds session resume with activity tick", () => {
    const result = buildSimulatorSyncEvents({ scenario: "session_resume", ssid: "HomeWiFi" });
    expect(result.events.map((event) => event.type)).toEqual(["session_resume", "activity_tick"]);
  });

  it("starts a visit on wifi_office when none is open", () => {
    const result = buildSimulatorSyncEvents({ scenario: "wifi_office" });
    expect(result.events.some((event) => event.type === "visit_start")).toBe(true);
    expect(result.openVisit).not.toBeNull();
  });
});

describe("buildAgentSyncBody", () => {
  it("includes token, serial, and events", () => {
    const user = {
      email: "demo.compliant@office-tracker.test",
      name: "Demo",
      role: "user",
      password: "x",
      token: "token-value",
      serial: "DEMO-LAPTOP-01",
    };
    const events = [{ id: "evt-1", type: "health_ping" }];
    const body = buildAgentSyncBody({ user, events, apiUrl: "https://example.test" });
    expect(body.token).toBe("token-value");
    expect(body.serialNumber).toBe("DEMO-LAPTOP-01");
    expect(body.events).toEqual(events);
    expect(body.syncTrigger).toBe("simulator");
  });
});

describe("officeSsidOptions", () => {
  it("includes office allowlist and home ssid", () => {
    const options = officeSsidOptions();
    expect(options).toContain("OfficeConnect");
    expect(options).toContain("HomeWiFi");
  });
});

describe("isRemoteApiMode", () => {
  const original = process.env.OFFICETRACKER_REMOTE_API;

  afterEach(() => {
    if (original === undefined) delete process.env.OFFICETRACKER_REMOTE_API;
    else process.env.OFFICETRACKER_REMOTE_API = original;
  });

  it("detects remote api flag", () => {
    process.env.OFFICETRACKER_REMOTE_API = "1";
    expect(isRemoteApiMode()).toBe(true);
  });
});
