import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_PRESENCE_TYPES } from "@/lib/activity-signal";

const prismaMocks = vi.hoisted(() => ({
  agentEventFindFirst: vi.fn(),
  presenceFindFirst: vi.fn(),
  heartbeatFindFirst: vi.fn(),
  activityFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    agentEvent: { findFirst: prismaMocks.agentEventFindFirst },
    presenceTransition: { findFirst: prismaMocks.presenceFindFirst },
    heartbeat: { findFirst: prismaMocks.heartbeatFindFirst },
    activityTick: { findFirst: prismaMocks.activityFindFirst },
  },
}));

import {
  buildAgentStatusDiagnostics,
  fetchAgentStatusEvidence,
  IN_OFFICE_NOW_RULE,
  type AgentStatusEvidence,
} from "@/lib/agent-status-diagnostics";

const OFFICE_SSIDS = ["OfficeConnect", "ExternalConnect", "pwcglb.com"];

/** Screenshot times: 12:41:27 pm and 3:36:11 pm on 15 Oct 2026, Asia/Kolkata. */
const TICK_AT = new Date("2026-10-15T07:11:27.000Z");
const WIFI_AT = new Date("2026-10-15T09:30:00.000Z");
const SYNC_AT = new Date("2026-10-15T10:06:08.000Z");
const CONTACT_AT = new Date("2026-10-15T10:06:11.000Z");
const VISIT_AT = new Date("2026-10-15T03:34:00.000Z");

function evidence(overrides: Partial<AgentStatusEvidence> = {}): AgentStatusEvidence {
  return {
    syncBatch: null,
    presenceSample: null,
    heartbeatSample: null,
    activityTick: null,
    ...overrides,
  };
}

describe("agent status diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps sync, device contact, Wi-Fi sample, and activity tick as different fields", () => {
    const diagnostics = buildAgentStatusDiagnostics({
      evidence: evidence({
        syncBatch: {
          createdAt: SYNC_AT,
          deviceId: "laptop-1",
          syncTrigger: "health_ping",
        },
        presenceSample: {
          at: WIFI_AT,
          ssid: null,
          storedInOffice: false,
          source: "health_ping",
        },
        activityTick: {
          at: TICK_AT,
          ssid: "OfficeConnect",
          inOffice: true,
        },
      }),
      devices: [
        {
          id: "laptop-1",
          serialNumber: "5CG4351B04",
          lastSeenAt: CONTACT_AT,
        },
      ],
      officeSsids: OFFICE_SSIDS,
      openVisit: { startAt: VISIT_AT, ssid: "OfficeConnect", source: "wifi" },
      inOfficeNowSignal: {
        at: WIFI_AT,
        inOffice: false,
        ssid: null,
        source: "health_ping",
      },
      now: new Date("2026-10-15T11:30:27.000Z"),
    });

    expect(diagnostics.lastSuccessfulSync).toMatchObject({
      at: SYNC_AT.toISOString(),
      trigger: "health_ping",
      triggerLabel: "Sync: health ping",
      serialNumber: "5CG4351B04",
    });
    expect(diagnostics.lastDeviceContactAt).toBe(CONTACT_AT.toISOString());
    expect(diagnostics.lastWifiSample).toMatchObject({
      at: WIFI_AT.toISOString(),
      ssid: null,
      officeSsid: null,
      storedInOffice: false,
      source: "health_ping",
      sourceLabel: "Health snapshot",
    });
    expect(diagnostics.lastActivityTick).toMatchObject({
      at: TICK_AT.toISOString(),
      ssid: "OfficeConnect",
      officeSsid: true,
      inOffice: true,
    });
    expect(diagnostics.minutesSinceLastActivityTick).toBe(4 * 60 + 19);

    const times = [
      diagnostics.lastSuccessfulSync?.at,
      diagnostics.lastDeviceContactAt,
      diagnostics.lastWifiSample?.at,
      diagnostics.lastActivityTick?.at,
    ];
    expect(new Set(times).size).toBe(4);
    expect(diagnostics.lastActivityTick?.at).not.toBe(diagnostics.lastDeviceContactAt);
    expect(diagnostics.openVisit).toMatchObject({
      startAt: VISIT_AT.toISOString(),
      ssid: "OfficeConnect",
      officeSsid: true,
      sourceLabel: "Wi-Fi visit",
    });
    expect(diagnostics.inOfficeNowRule).toBe(IN_OFFICE_NOW_RULE);
    expect(diagnostics.inOfficeNowSignal).toMatchObject({
      at: WIFI_AT.toISOString(),
      ssid: null,
      officeSsid: null,
      inOffice: false,
      source: "health_ping",
    });
  });

  it("does not invent a Wi-Fi sample from an activity tick", () => {
    const diagnostics = buildAgentStatusDiagnostics({
      evidence: evidence({
        activityTick: { at: TICK_AT, ssid: "ExternalConnect", inOffice: true },
      }),
      devices: [],
      officeSsids: OFFICE_SSIDS,
      openVisit: null,
      inOfficeNowSignal: null,
    });

    expect(diagnostics.lastWifiSample).toBeNull();
    expect(diagnostics.lastSuccessfulSync).toBeNull();
    expect(diagnostics.lastDeviceContactAt).toBeNull();
    expect(diagnostics.lastActivityTick).toMatchObject({
      ssid: "ExternalConnect",
      officeSsid: true,
      inOffice: true,
    });
    expect(diagnostics.openVisit).toBeNull();
    expect(diagnostics.inOfficeNowSignal).toBeNull();
  });

  it("uses the newer heartbeat sample and keeps a non-office SSID false", () => {
    const heartbeatAt = new Date("2026-10-15T10:10:00.000Z");
    const diagnostics = buildAgentStatusDiagnostics({
      evidence: evidence({
        presenceSample: {
          at: WIFI_AT,
          ssid: "OfficeConnect",
          storedInOffice: true,
          source: "wifi_connected",
        },
        heartbeatSample: {
          at: heartbeatAt,
          ssid: "HomeWifi",
          storedInOffice: true,
          source: "wifi",
        },
      }),
      devices: [
        { id: "old", serialNumber: "OLD", lastSeenAt: TICK_AT },
        { id: "new", serialNumber: "NEW", lastSeenAt: CONTACT_AT },
      ],
      officeSsids: OFFICE_SSIDS,
      openVisit: null,
      inOfficeNowSignal: null,
    });

    expect(diagnostics.lastWifiSample).toMatchObject({
      at: heartbeatAt.toISOString(),
      ssid: "HomeWifi",
      officeSsid: false,
      storedInOffice: true,
      source: "wifi",
      sourceLabel: "Heartbeat Wi-Fi sample",
    });
    expect(diagnostics.lastDeviceContactAt).toBe(CONTACT_AT.toISOString());
  });

  it("keeps the presence sample when it is at least as new as the heartbeat", () => {
    const diagnostics = buildAgentStatusDiagnostics({
      evidence: evidence({
        presenceSample: {
          at: WIFI_AT,
          ssid: "OfficeConnect 5",
          storedInOffice: true,
          source: "ssid_changed",
        },
        heartbeatSample: {
          at: WIFI_AT,
          ssid: "HomeWifi",
          storedInOffice: false,
          source: "wifi",
        },
      }),
      devices: [],
      officeSsids: OFFICE_SSIDS,
      openVisit: null,
      inOfficeNowSignal: null,
    });

    expect(diagnostics.lastWifiSample).toMatchObject({
      source: "ssid_changed",
      ssid: "OfficeConnect",
      officeSsid: true,
    });
  });

  it("loads sync, presence, heartbeat, and activity tick as separate queries", async () => {
    prismaMocks.agentEventFindFirst.mockResolvedValue({
      createdAt: SYNC_AT,
      deviceId: "laptop-1",
      payload: { syncTrigger: "not-a-trigger" },
    });
    prismaMocks.presenceFindFirst.mockResolvedValue({
      at: WIFI_AT,
      ssid: "",
      inOffice: false,
      type: "health_ping",
    });
    prismaMocks.heartbeatFindFirst.mockResolvedValue(null);
    prismaMocks.activityFindFirst.mockResolvedValue({
      at: TICK_AT,
      ssid: "OfficeConnect",
      inOffice: true,
    });

    const loaded = await fetchAgentStatusEvidence("user-1");

    expect(loaded.syncBatch?.syncTrigger).toBeNull();
    expect(loaded.presenceSample?.source).toBe("health_ping");
    expect(loaded.heartbeatSample).toBeNull();
    expect(loaded.activityTick?.at).toEqual(TICK_AT);
    expect(prismaMocks.presenceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          type: { in: [...LIVE_PRESENCE_TYPES] },
        },
        orderBy: { at: "desc" },
      }),
    );
    expect(prismaMocks.activityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { at: "desc" },
      }),
    );
    const presenceTypes = prismaMocks.presenceFindFirst.mock.calls[0][0].where.type.in as string[];
    expect(presenceTypes).not.toContain("activity_tick");
  });
});
