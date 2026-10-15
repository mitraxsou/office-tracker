import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getRealCurrentUser: vi.fn(),
  getTodaySummary: vi.fn(),
  getPulseStats: vi.fn(),
  getAppConfig: vi.fn(),
  getUserHoursTarget: vi.fn(),
  getEffectiveAgentStaleGraceHours: vi.fn(),
  isUserOutOfOffice: vi.fn(),
  fetchAgentStatusEvidence: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getRealCurrentUser: mocks.getRealCurrentUser,
}));

vi.mock("@/lib/heartbeat-service", () => ({
  getTodaySummary: mocks.getTodaySummary,
  getPulseStats: mocks.getPulseStats,
}));

vi.mock("@/lib/app-config", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/app-config")>("../src/lib/app-config");
  return {
    ...actual,
    getAppConfig: mocks.getAppConfig,
    getUserHoursTarget: mocks.getUserHoursTarget,
    getEffectiveAgentStaleGraceHours: mocks.getEffectiveAgentStaleGraceHours,
  };
});

vi.mock("@/lib/out-of-office", () => ({
  isUserOutOfOffice: mocks.isUserOutOfOffice,
}));

vi.mock("@/lib/agent-status-diagnostics", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/agent-status-diagnostics")>(
    "../src/lib/agent-status-diagnostics",
  );
  return {
    ...actual,
    fetchAgentStatusEvidence: mocks.fetchAgentStatusEvidence,
  };
});

import { GET } from "../src/app/api/settings/agent-status/route";
import { IN_OFFICE_NOW_RULE } from "../src/lib/agent-status-diagnostics";

const TICK_AT = "2026-10-15T07:11:27.000Z";
const WIFI_AT = "2026-10-15T09:30:00.000Z";
const SYNC_AT = "2026-10-15T10:06:08.000Z";
const CONTACT_AT = "2026-10-15T10:06:11.000Z";
const VISIT_AT = "2026-10-15T03:34:00.000Z";

function adminUser(lastSeenAt: Date | null) {
  return {
    id: "u-aleyaa",
    role: "admin",
    timezone: "Asia/Kolkata",
    hoursTarget: null,
    agentStaleGraceHours: null,
    agentTokens: [],
    agentDevices: [
      {
        id: "laptop-1",
        serialNumber: "5CG4351B04",
        lastSeenAt,
        createdAt: new Date("2026-10-01T04:00:00.000Z"),
        installedAt: new Date("2026-10-01T04:00:00.000Z"),
      },
    ],
  };
}

describe("GET /api/settings/agent-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserHoursTarget.mockResolvedValue(5);
    mocks.getEffectiveAgentStaleGraceHours.mockResolvedValue(6);
    mocks.getAppConfig.mockResolvedValue({
      officeSsids: ["OfficeConnect", "ExternalConnect", "pwcglb.com"],
    });
    mocks.isUserOutOfOffice.mockResolvedValue(false);
    mocks.getPulseStats.mockResolvedValue({
      agentHealthy: true,
      lastHeartbeat: TICK_AT,
      pulsesLast24h: 119,
      expectedPulsesPerDay: 288,
      minutesSinceLastPulse: 259,
      recentPulses: [],
    });
  });

  it("returns 401 when not signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for regular users", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "u1", role: "user", timezone: "UTC" });
    mocks.getRealCurrentUser.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns distinct sync, contact, Wi-Fi, and tick fields", async () => {
    mocks.getCurrentUser.mockResolvedValue(adminUser(new Date(CONTACT_AT)));
    mocks.getRealCurrentUser.mockResolvedValue({ role: "admin" });
    mocks.getTodaySummary.mockResolvedValue({
      inOfficeNow: false,
      visits: [
        {
          endAt: null,
          startAt: new Date(VISIT_AT),
          ssid: "OfficeConnect",
          source: "wifi",
        },
      ],
      livePresence: {
        at: new Date(WIFI_AT),
        inOffice: false,
        ssid: null,
        source: "health_ping",
      },
    });
    mocks.fetchAgentStatusEvidence.mockResolvedValue({
      syncBatch: {
        createdAt: new Date(SYNC_AT),
        deviceId: "laptop-1",
        syncTrigger: "health_ping",
      },
      presenceSample: {
        at: new Date(WIFI_AT),
        ssid: null,
        storedInOffice: false,
        source: "health_ping",
      },
      heartbeatSample: null,
      activityTick: {
        at: new Date(TICK_AT),
        ssid: "OfficeConnect",
        inOffice: true,
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.lastHeartbeat).toBe(TICK_AT);
    expect(body.lastSuccessfulSync.at).toBe(SYNC_AT);
    expect(body.lastDeviceContactAt).toBe(CONTACT_AT);
    expect(body.lastWifiSample).toMatchObject({
      at: WIFI_AT,
      ssid: null,
      officeSsid: null,
      storedInOffice: false,
      source: "health_ping",
    });
    expect(body.lastActivityTick).toMatchObject({
      at: TICK_AT,
      ssid: "OfficeConnect",
      officeSsid: true,
      inOffice: true,
    });
    expect(body.devices[0]).toMatchObject({
      serialNumber: "5CG4351B04",
      lastSeenAt: CONTACT_AT,
    });
    expect(body.devices[0].lastSeenAt).not.toBe(body.lastActivityTick.at);
    expect(body.lastDeviceContactAt).not.toBe(body.lastActivityTick.at);
    expect(body.inOfficeNow).toBe(false);
    expect(body.inOfficeNowRule).toBe(IN_OFFICE_NOW_RULE);
    expect(body.inOfficeNowSignal).toMatchObject({
      at: WIFI_AT,
      inOffice: false,
      source: "health_ping",
      ssid: null,
    });
    expect(body.openVisit).toMatchObject({
      startAt: VISIT_AT,
      ssid: "OfficeConnect",
      officeSsid: true,
    });
  });

  it("returns empty states when sync, Wi-Fi, and tick rows are absent", async () => {
    mocks.getCurrentUser.mockResolvedValue(adminUser(null));
    mocks.getRealCurrentUser.mockResolvedValue({ role: "admin" });
    mocks.getTodaySummary.mockResolvedValue({
      inOfficeNow: false,
      visits: [],
      livePresence: null,
    });
    mocks.fetchAgentStatusEvidence.mockResolvedValue({
      syncBatch: null,
      presenceSample: null,
      heartbeatSample: null,
      activityTick: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.lastSuccessfulSync).toBeNull();
    expect(body.lastDeviceContactAt).toBeNull();
    expect(body.lastWifiSample).toBeNull();
    expect(body.lastActivityTick).toBeNull();
    expect(body.minutesSinceLastActivityTick).toBeNull();
    expect(body.openVisit).toBeNull();
    expect(body.inOfficeNow).toBe(false);
    expect(body.inOfficeNowSignal).toBeNull();
    expect(body.inOfficeNowRule).toBe(IN_OFFICE_NOW_RULE);
    expect(body.devices[0].lastSeenAt).toBeNull();
  });
});
