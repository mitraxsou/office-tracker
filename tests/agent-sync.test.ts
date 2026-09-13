import { beforeEach, describe, expect, it, vi } from "vitest";

const agentEventFindUniqueMock = vi.hoisted(() => vi.fn());
const agentEventUpsertMock = vi.hoisted(() => vi.fn());
const agentEventCreateMock = vi.hoisted(() => vi.fn());
const presenceTransitionCreateMock = vi.hoisted(() => vi.fn());
const activityTickCreateMock = vi.hoisted(() => vi.fn());
const visitFindFirstMock = vi.hoisted(() => vi.fn());
const visitFindManyMock = vi.hoisted(() => vi.fn());
const visitUpdateMock = vi.hoisted(() => vi.fn());
const dailySummaryUpsertMock = vi.hoisted(() => vi.fn());
const userFindUniqueMock = vi.hoisted(() => vi.fn());
const loadDaySpanContextMock = vi.hoisted(() => vi.fn());
const runVisitMaintenanceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    agentEvent: {
      findUnique: agentEventFindUniqueMock,
      upsert: agentEventUpsertMock,
      create: agentEventCreateMock,
    },
    presenceTransition: { create: presenceTransitionCreateMock },
    activityTick: { create: activityTickCreateMock },
    visit: {
      findFirst: visitFindFirstMock,
      findMany: visitFindManyMock,
      create: vi.fn(),
      update: visitUpdateMock,
    },
    dailySummary: { upsert: dailySummaryUpsertMock },
    user: { findUnique: userFindUniqueMock },
  },
}));
vi.mock("@/lib/app-config", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    officeSsids: ["OfficeConnect"],
    heartbeatIntervalMinutes: 5,
    agentStaleMinutes: 15,
    agentMode: "event",
  }),
  getUserHoursTarget: vi.fn().mockResolvedValue(5),
}));
vi.mock("@/lib/agent-version", () => ({
  getAgentVersion: () => "1.3.2",
}));
vi.mock("@/lib/agent-update", () => ({
  getDeviceForceAgentUpdate: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/agent-download", () => ({
  agentScriptFilesBaseUrl: () => "https://example/agent/files",
  vercelProtectionBypassSecret: () => null,
}));
vi.mock("@/lib/heartbeat-alerts", () => ({
  maybeDispatchHeartbeatAlerts: vi.fn(),
}));
vi.mock("@/lib/heartbeat-service", () => ({
  loadDaySpanContext: loadDaySpanContextMock,
  runVisitMaintenance: runVisitMaintenanceMock,
}));

import {
  parseAgentSyncEvents,
  parseAgentSyncOpenVisit,
  processAgentSync,
  sortAgentSyncEventsForProcessing,
} from "../src/lib/agent-sync";
import { dayBoundsFromKey } from "../src/lib/timezone-dates";

describe("parseAgentSyncEvents", () => {
  it("parses valid event array", () => {
    const events = parseAgentSyncEvents([
      {
        id: "evt-1",
        type: "ssid_changed",
        at: "2026-09-12T10:00:00.000Z",
        ssid: "OfficeConnect",
        previousSsid: "HomeWiFi",
      },
      { id: "evt-2", type: "visit_start", localVisitId: "lv-abc", ssid: "OfficeConnect" },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("ssid_changed");
    expect(events[1].localVisitId).toBe("lv-abc");
  });

  it("returns empty array for invalid input", () => {
    expect(parseAgentSyncEvents(null)).toEqual([]);
    expect(parseAgentSyncEvents("bad")).toEqual([]);
    expect(parseAgentSyncEvents([{ type: "missing-id" }])).toEqual([]);
  });
});

describe("parseAgentSyncOpenVisit", () => {
  it("parses open visit payload", () => {
    const open = parseAgentSyncOpenVisit({
      localVisitId: "lv-1",
      startAt: "2026-09-12T09:00:00.000Z",
      ssid: "OfficeConnect",
    });
    expect(open).toEqual({
      localVisitId: "lv-1",
      startAt: "2026-09-12T09:00:00.000Z",
      ssid: "OfficeConnect",
    });
  });

  it("returns null when required fields missing", () => {
    expect(parseAgentSyncOpenVisit({ startAt: "2026-09-12T09:00:00.000Z" })).toBeNull();
    expect(parseAgentSyncOpenVisit(null)).toBeNull();
  });
});

describe("sortAgentSyncEventsForProcessing", () => {
  it("processes visit_end before daily_summary and session_resume", () => {
    const sorted = sortAgentSyncEventsForProcessing([
      { id: "3", type: "daily_summary", at: "2026-09-13T03:30:00.000Z", dayKey: "2026-09-12" },
      { id: "1", type: "visit_end", at: "2026-09-12T14:00:00.000Z", localVisitId: "lv-1" },
      { id: "2", type: "session_resume", at: "2026-09-13T03:30:00.000Z" },
    ]);
    expect(sorted.map((event) => event.type)).toEqual([
      "visit_end",
      "session_resume",
      "daily_summary",
    ]);
  });
});

describe("processAgentSync session_resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentEventFindUniqueMock.mockResolvedValue(null);
    agentEventUpsertMock.mockResolvedValue({});
    agentEventCreateMock.mockResolvedValue({});
    presenceTransitionCreateMock.mockResolvedValue({});
    activityTickCreateMock.mockResolvedValue({});
    visitFindFirstMock.mockResolvedValue(null);
    visitFindManyMock.mockResolvedValue([]);
    dailySummaryUpsertMock.mockResolvedValue({});
    userFindUniqueMock.mockResolvedValue({ hoursTarget: 5 });
    loadDaySpanContextMock.mockResolvedValue({
      visits: [],
      params: {},
      lastHeartbeat: null,
      laptopActiveParams: {},
    });
    runVisitMaintenanceMock.mockResolvedValue(undefined);
  });

  it("parses gapMinutes on session_resume events", () => {
    const events = parseAgentSyncEvents([
      {
        id: "evt-resume",
        type: "session_resume",
        at: "2026-09-13T08:00:00.000Z",
        ssid: "HomeWiFi",
        gapMinutes: 480,
      },
    ]);
    expect(events[0].gapMinutes).toBe(480);
  });

  it("records session_resume and runs maintenance after events", async () => {
    const result = await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-resume",
          type: "session_resume",
          at: "2026-09-13T08:00:00.000Z",
          ssid: "OfficeConnect",
          gapMinutes: 12,
        },
      ],
      appUrl: "https://office.example",
    });

    expect(loadDaySpanContextMock).not.toHaveBeenCalled();
    expect(runVisitMaintenanceMock).toHaveBeenCalledWith("user-1", "Asia/Kolkata");
    expect(presenceTransitionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "session_resume",
        inOffice: true,
        ssid: "OfficeConnect",
      }),
    });
    expect(result.ackedEventIds).toContain("evt-resume");
  });

  it("processes visit_end before daily_summary in the same batch", async () => {
    const disconnectAt = new Date("2026-09-12T18:00:00.000Z");
    const openVisit = {
      id: "visit-1",
      userId: "user-1",
      localVisitId: "lv-1",
      startAt: new Date("2026-09-12T04:00:00.000Z"),
      endAt: null,
    };
    const callOrder: string[] = [];
    visitFindFirstMock.mockImplementation(async (args: { where?: { localVisitId?: string } }) => {
      if (args?.where?.localVisitId) return openVisit;
      return null;
    });
    visitUpdateMock.mockImplementation(async () => {
      callOrder.push("visit_end");
      return {};
    });
    dailySummaryUpsertMock.mockImplementation(async () => {
      callOrder.push("daily_summary");
      return {};
    });
    const closedVisit = { ...openVisit, endAt: disconnectAt };
    visitFindManyMock.mockResolvedValue([closedVisit]);
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-09-12", "Asia/Kolkata");
    loadDaySpanContextMock.mockResolvedValue({
      visits: [closedVisit],
      params: {
        dayStart,
        dayEnd,
        now: new Date("2026-09-13T00:05:00.000Z"),
      },
      lastHeartbeat: null,
      laptopActiveParams: {},
    });

    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-summary",
          type: "daily_summary",
          at: "2026-09-13T00:05:00.000Z",
          dayKey: "2026-09-12",
          officeMs: 5 * 60 * 60 * 1000,
          visitCount: 1,
        },
        {
          id: "evt-end",
          type: "visit_end",
          at: disconnectAt.toISOString(),
          localVisitId: "lv-1",
          previousSsid: "OfficeConnect",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(callOrder).toEqual(["visit_end", "daily_summary"]);
  });

  it("accepts home Wi-Fi activity_tick without creating a visit", async () => {
    const result = await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-tick",
          type: "activity_tick",
          at: "2026-09-13T08:00:00.000Z",
          ssid: "HomeWiFi",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(activityTickCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inOffice: false,
        ssid: "HomeWiFi",
      }),
    });
    expect(visitUpdateMock).not.toHaveBeenCalled();
    expect(result.rejected).toEqual([]);
    expect(result.serverState.inOfficeNow).toBe(false);
  });

  it("records sync_batch when syncTrigger is provided", async () => {
    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-tick",
          type: "activity_tick",
          at: "2026-09-13T08:00:00.000Z",
          ssid: "HomeWiFi",
        },
      ],
      appUrl: "https://office.example",
      syncTrigger: "activity_tick",
    });

    expect(agentEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "sync_batch",
        payload: expect.objectContaining({
          syncTrigger: "activity_tick",
          eventCount: 1,
          eventTypes: ["activity_tick"],
        }),
      }),
    });
  });

  it("rejects visit_start when SSID is not on the office allowlist", async () => {
    const result = await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-start",
          type: "visit_start",
          at: "2026-09-13T09:00:00.000Z",
          localVisitId: "lv-home",
          ssid: "HomeWiFi",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(result.rejected).toEqual([{ id: "evt-start", reason: "ssid_not_allowed" }]);
  });

  it("applies visit_end before running maintenance on wake batches", async () => {
    const disconnectAt = new Date("2026-09-12T14:00:00.000Z");
    const openVisit = {
      id: "visit-1",
      userId: "user-1",
      localVisitId: "lv-1",
      startAt: new Date("2026-09-12T04:00:00.000Z"),
      endAt: null,
    };
    visitFindFirstMock.mockImplementation(async (args: { where?: { localVisitId?: string } }) => {
      if (args?.where?.localVisitId) return openVisit;
      return null;
    });
    visitUpdateMock.mockResolvedValue({});

    const result = await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-end",
          type: "visit_end",
          at: disconnectAt.toISOString(),
          localVisitId: "lv-1",
          previousSsid: "OfficeConnect",
        },
        {
          id: "evt-resume",
          type: "session_resume",
          at: "2026-09-13T03:30:00.000Z",
          ssid: "HomeWiFi",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(result.rejected).toEqual([]);
    expect(visitUpdateMock).toHaveBeenCalledWith({
      where: { id: "visit-1" },
      data: { endAt: disconnectAt },
    });
    expect(runVisitMaintenanceMock).toHaveBeenCalled();
  });
});
