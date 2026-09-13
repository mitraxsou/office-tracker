import { beforeEach, describe, expect, it, vi } from "vitest";

const agentEventFindUniqueMock = vi.hoisted(() => vi.fn());
const agentEventUpsertMock = vi.hoisted(() => vi.fn());
const presenceTransitionCreateMock = vi.hoisted(() => vi.fn());
const activityTickCreateMock = vi.hoisted(() => vi.fn());
const visitFindFirstMock = vi.hoisted(() => vi.fn());
const userFindUniqueMock = vi.hoisted(() => vi.fn());
const loadDaySpanContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    agentEvent: {
      findUnique: agentEventFindUniqueMock,
      upsert: agentEventUpsertMock,
    },
    presenceTransition: { create: presenceTransitionCreateMock },
    activityTick: { create: activityTickCreateMock },
    visit: { findFirst: visitFindFirstMock, findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    dailySummary: { upsert: vi.fn() },
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
  getAgentVersion: () => "1.3.1",
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
}));

import {
  parseAgentSyncEvents,
  parseAgentSyncOpenVisit,
  processAgentSync,
} from "../src/lib/agent-sync";

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

describe("processAgentSync session_resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentEventFindUniqueMock.mockResolvedValue(null);
    agentEventUpsertMock.mockResolvedValue({});
    presenceTransitionCreateMock.mockResolvedValue({});
    activityTickCreateMock.mockResolvedValue({});
    visitFindFirstMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue({ hoursTarget: 5 });
    loadDaySpanContextMock.mockResolvedValue({
      visits: [],
      params: {},
      lastHeartbeat: null,
      laptopActiveParams: {},
    });
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

  it("records session_resume and closes prior-day visits early", async () => {
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

    expect(loadDaySpanContextMock).toHaveBeenCalled();
    expect(presenceTransitionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "session_resume",
        inOffice: true,
        ssid: "OfficeConnect",
      }),
    });
    expect(result.ackedEventIds).toContain("evt-resume");
  });
});
