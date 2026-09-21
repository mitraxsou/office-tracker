import { beforeEach, describe, expect, it, vi } from "vitest";

const agentEventFindUniqueMock = vi.hoisted(() => vi.fn());
const agentEventUpsertMock = vi.hoisted(() => vi.fn());
const agentEventCreateMock = vi.hoisted(() => vi.fn());
const presenceTransitionCreateMock = vi.hoisted(() => vi.fn());
const activityTickCreateMock = vi.hoisted(() => vi.fn());
const visitFindFirstMock = vi.hoisted(() => vi.fn());
const visitFindManyMock = vi.hoisted(() => vi.fn());
const visitCreateMock = vi.hoisted(() => vi.fn());
const visitUpdateMock = vi.hoisted(() => vi.fn());
const maybeDispatchHeartbeatAlertsMock = vi.hoisted(() => vi.fn());
const dailySummaryUpsertMock = vi.hoisted(() => vi.fn());
const dailySummaryFindUniqueMock = vi.hoisted(() => vi.fn());
const userFindUniqueMock = vi.hoisted(() => vi.fn());
const loadDaySpanContextMock = vi.hoisted(() => vi.fn());
const maybeRunVisitMaintenanceMock = vi.hoisted(() => vi.fn());

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
      create: visitCreateMock,
      update: visitUpdateMock,
    },
    dailySummary: { upsert: dailySummaryUpsertMock, findUnique: dailySummaryFindUniqueMock },
    user: { findUnique: userFindUniqueMock },
  },
}));
vi.mock("@/lib/app-config", () => ({
  getUserHoursTarget: vi.fn().mockResolvedValue(5),
}));
vi.mock("@/lib/agent-config-cache", () => ({
  getCachedAppConfig: vi.fn().mockResolvedValue({
    officeSsids: ["OfficeConnect"],
    heartbeatIntervalMinutes: 5,
    agentStaleMinutes: 15,
    agentMode: "events",
  }),
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
  maybeDispatchHeartbeatAlerts: maybeDispatchHeartbeatAlertsMock,
}));
vi.mock("@/lib/heartbeat-service", () => ({
  loadDaySpanContext: loadDaySpanContextMock,
  maybeRunVisitMaintenance: maybeRunVisitMaintenanceMock,
}));

import {
  parseAgentSyncEvents,
  parseAgentSyncOpenVisit,
  processAgentSync,
  sortAgentSyncEventsForProcessing,
  syncBatchNeedsVisitMaintenance,
} from "../src/lib/agent-sync";
import { dayBoundsFromKey } from "../src/lib/timezone-dates";

describe("parseAgentSyncEvents", () => {
  it("parses valid event array", () => {
    const events = parseAgentSyncEvents([
      {
        id: "evt-1",
        type: "ssid_changed",
        at: "2026-09-20T10:00:00.000Z",
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
      startAt: "2026-09-20T09:00:00.000Z",
      ssid: "OfficeConnect",
    });
    expect(open).toEqual({
      localVisitId: "lv-1",
      startAt: "2026-09-20T09:00:00.000Z",
      ssid: "OfficeConnect",
    });
  });

  it("returns null when required fields missing", () => {
    expect(parseAgentSyncOpenVisit({ startAt: "2026-09-20T09:00:00.000Z" })).toBeNull();
    expect(parseAgentSyncOpenVisit(null)).toBeNull();
  });
});

describe("sortAgentSyncEventsForProcessing", () => {
  it("processes visit_end before daily_summary and session_resume", () => {
    const sorted = sortAgentSyncEventsForProcessing([
      { id: "3", type: "daily_summary", at: "2026-09-20T03:30:00.000Z", dayKey: "2026-09-19" },
      { id: "1", type: "visit_end", at: "2026-09-19T14:00:00.000Z", localVisitId: "lv-1" },
      { id: "2", type: "session_resume", at: "2026-09-20T03:30:00.000Z" },
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
    dailySummaryFindUniqueMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue({ hoursTarget: 5 });
    loadDaySpanContextMock.mockResolvedValue({
      visits: [],
      params: {},
      lastHeartbeat: null,
      laptopActiveParams: {},
      firstAgentOnAt: null,
    });
    maybeRunVisitMaintenanceMock.mockResolvedValue(true);
  });

  it("parses gapMinutes on session_resume events", () => {
    const events = parseAgentSyncEvents([
      {
        id: "evt-resume",
        type: "session_resume",
        at: "2026-09-20T08:00:00.000Z",
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
          at: "2026-09-20T08:00:00.000Z",
          ssid: "OfficeConnect",
          gapMinutes: 12,
        },
      ],
      appUrl: "https://office.example",
    });

    expect(loadDaySpanContextMock).not.toHaveBeenCalled();
    expect(maybeRunVisitMaintenanceMock).toHaveBeenCalledWith(
      "user-1",
      "Asia/Kolkata",
      undefined,
      { force: true },
    );
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
    const disconnectAt = new Date("2026-09-19T18:00:00.000Z");
    const openVisit = {
      id: "visit-1",
      userId: "user-1",
      localVisitId: "lv-1",
      startAt: new Date("2026-09-19T04:00:00.000Z"),
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
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-09-19", "Asia/Kolkata");
    loadDaySpanContextMock.mockResolvedValue({
      visits: [closedVisit],
      params: {
        dayStart,
        dayEnd,
        now: new Date("2026-09-20T00:05:00.000Z"),
      },
      lastHeartbeat: null,
      laptopActiveParams: {},
      firstAgentOnAt: null,
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
          at: "2026-09-20T00:05:00.000Z",
          dayKey: "2026-09-19",
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
          at: "2026-09-20T08:00:00.000Z",
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
    expect(visitCreateMock).not.toHaveBeenCalled();
    expect(result.rejected).toEqual([]);
    expect(result.serverState.inOfficeNow).toBe(false);
  });

  it("reopens invalid closed visit when office activity continues", async () => {
    const invalidVisit = {
      id: "visit-bad",
      userId: "user-1",
      deviceId: "device-1",
      startAt: new Date("2026-09-21T09:04:09.625Z"),
      endAt: new Date("2026-09-21T07:18:04.147Z"),
      source: "wifi",
      ssid: "OfficeConnect",
    };
    visitFindFirstMock.mockImplementation(async (args: {
      where?: { endAt?: null | { not: null }; deviceId?: string };
    }) => {
      if (args?.where?.endAt === null) return null;
      if (args?.where?.endAt && typeof args.where.endAt === "object") return invalidVisit;
      return null;
    });

    const result = await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-tick",
          type: "activity_tick",
          at: "2026-09-21T12:40:00.000Z",
          ssid: "OfficeConnect",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(visitUpdateMock).toHaveBeenCalledWith({
      where: { id: "visit-bad" },
      data: expect.objectContaining({ endAt: null }),
    });
    expect(result.rejected).toEqual([]);
  });

  it("creates a visit when office activity continues with no open visit", async () => {
    visitFindFirstMock.mockResolvedValue(null);
    visitCreateMock.mockResolvedValue({
      id: "visit-new",
      endAt: null,
      startAt: new Date("2026-09-21T12:40:00.000Z"),
    });

    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-tick",
          type: "activity_tick",
          at: "2026-09-21T12:40:00.000Z",
          ssid: "OfficeConnect",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(visitCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        deviceId: "device-1",
        source: "wifi",
        ssid: "OfficeConnect",
        startAt: new Date("2026-09-21T12:40:00.000Z"),
      }),
    });
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
          at: "2026-09-20T08:00:00.000Z",
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
          at: "2026-09-20T09:00:00.000Z",
          localVisitId: "lv-home",
          ssid: "HomeWiFi",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(result.rejected).toEqual([{ id: "evt-start", reason: "ssid_not_allowed" }]);
  });

  it("rejects visit_end when checkout is before check-in", async () => {
    const openVisit = {
      id: "visit-1",
      userId: "user-1",
      localVisitId: "lv-1",
      startAt: new Date("2026-09-20T08:38:00.000Z"),
      endAt: null,
    };
    visitFindFirstMock.mockImplementation(async (args: { where?: { localVisitId?: string } }) => {
      if (args?.where?.localVisitId) return openVisit;
      return null;
    });

    const result = await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-end",
          type: "visit_end",
          at: "2026-09-20T08:04:00.000Z",
          localVisitId: "lv-1",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(result.rejected).toEqual([
      { id: "evt-end", reason: "Check-out time cannot be before check-in" },
    ]);
    expect(visitUpdateMock).not.toHaveBeenCalled();
  });

  it("applies visit_end before running maintenance on wake batches", async () => {
    const disconnectAt = new Date("2026-09-20T14:00:00.000Z");
    const openVisit = {
      id: "visit-1",
      userId: "user-1",
      localVisitId: "lv-1",
      startAt: new Date("2026-09-20T04:00:00.000Z"),
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
          at: "2026-09-21T03:30:00.000Z",
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
    expect(maybeRunVisitMaintenanceMock).toHaveBeenCalled();
  });

  it("dispatches heartbeat alerts after visit_start on office Wi-Fi", async () => {
    const startAt = "2026-09-20T09:00:00.000Z";
    visitFindFirstMock.mockImplementation(async (args: { where?: { localVisitId?: string; endAt?: null } }) => {
      if (args?.where?.localVisitId) return null;
      if (args?.where?.endAt === null) {
        return { id: "visit-1", endAt: null, startAt: new Date("2026-09-20T08:00:00.000Z") };
      }
      return null;
    });
    visitCreateMock.mockResolvedValue({
      id: "visit-1",
      userId: "user-1",
      localVisitId: "lv-office",
      startAt: new Date(startAt),
      endAt: null,
    });

    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-start",
          type: "visit_start",
          at: startAt,
          localVisitId: "lv-office",
          ssid: "OfficeConnect",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(maybeDispatchHeartbeatAlertsMock).toHaveBeenCalledWith({
      userId: "user-1",
      timezone: "Asia/Kolkata",
      recordedAt: new Date(startAt),
      inOffice: true,
      hoursTarget: 5,
    });
  });

  it("skips visit maintenance for activity_tick-only batches", async () => {
    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-tick",
          type: "activity_tick",
          at: "2026-09-20T08:00:00.000Z",
          ssid: "HomeWiFi",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(maybeRunVisitMaintenanceMock).not.toHaveBeenCalled();
  });

  it("accepts hours_target_met and evaluates alerts", async () => {
    const metAt = "2026-09-20T14:05:00.000Z";
    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-met",
          type: "hours_target_met",
          at: metAt,
          dayKey: "2026-09-20",
          officeMs: 5 * 60 * 60 * 1000,
        },
      ],
      appUrl: "https://office.example",
    });

    expect(maybeDispatchHeartbeatAlertsMock).toHaveBeenCalledWith({
      userId: "user-1",
      timezone: "Asia/Kolkata",
      recordedAt: new Date(metAt),
      inOffice: false,
      hoursTarget: 5,
    });
  });

  it("evaluates alerts on every sync even when events are duplicates", async () => {
    agentEventFindUniqueMock.mockResolvedValue({ id: "existing" });
    visitFindFirstMock.mockResolvedValue({
      id: "visit-open",
      endAt: null,
      startAt: new Date("2026-09-20T09:00:00.000Z"),
    });

    await processAgentSync({
      userId: "user-1",
      userTimezone: "Asia/Kolkata",
      deviceId: "device-1",
      serialNumber: "SERIAL-1",
      events: [
        {
          id: "evt-dup",
          type: "activity_tick",
          at: "2026-09-20T08:00:00.000Z",
          ssid: "OfficeConnect",
        },
      ],
      appUrl: "https://office.example",
    });

    expect(maybeDispatchHeartbeatAlertsMock).toHaveBeenCalledTimes(1);
    expect(maybeDispatchHeartbeatAlertsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        inOffice: true,
        hoursTarget: 5,
      }),
    );
  });
});

describe("syncBatchNeedsVisitMaintenance", () => {
  it("returns true for session_resume and daily_summary", () => {
    expect(
      syncBatchNeedsVisitMaintenance([{ id: "1", type: "session_resume" }]),
    ).toBe(true);
    expect(
      syncBatchNeedsVisitMaintenance([{ id: "2", type: "daily_summary", dayKey: "2026-09-20" }]),
    ).toBe(true);
  });

  it("returns false for activity_tick and health_ping only", () => {
    expect(
      syncBatchNeedsVisitMaintenance([
        { id: "1", type: "activity_tick" },
        { id: "2", type: "health_ping" },
      ]),
    ).toBe(false);
  });
});
