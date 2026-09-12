import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAgentTokenMock = vi.hoisted(() => vi.fn());
const bindAgentTokenToSerialMock = vi.hoisted(() => vi.fn());
const registerOrUpdateDeviceMock = vi.hoisted(() => vi.fn());
const recordHeartbeatLifecycleMock = vi.hoisted(() => vi.fn());
const recordDeviceScriptVersionMock = vi.hoisted(() => vi.fn());
const getUserByAgentTokenMock = vi.hoisted(() => vi.fn());
const getAppConfigMock = vi.hoisted(() => vi.fn());
const processHeartbeatMock = vi.hoisted(() => vi.fn());
const maybeDispatchHeartbeatAlertsMock = vi.hoisted(() => vi.fn());
const visitFindFirstMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const backfillInstallTokenEncIfNeededMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agent-auth", () => ({
  authenticateAgentToken: authenticateAgentTokenMock,
  bindAgentTokenToSerial: bindAgentTokenToSerialMock,
  logAgentDeviceRegistered: vi.fn(),
  registerOrUpdateDevice: registerOrUpdateDeviceMock,
}));
vi.mock("@/lib/agent-lifecycle", () => ({
  recordHeartbeatLifecycle: recordHeartbeatLifecycleMock,
}));
vi.mock("@/lib/agent-update", () => ({
  recordDeviceScriptVersion: recordDeviceScriptVersionMock,
}));
vi.mock("@/lib/auth", () => ({
  backfillInstallTokenEncIfNeeded: backfillInstallTokenEncIfNeededMock,
  getUserByAgentToken: getUserByAgentTokenMock,
}));
vi.mock("@/lib/app-config", () => ({
  getAppConfig: getAppConfigMock,
  getUserHoursTarget: vi.fn(),
}));
vi.mock("@/lib/heartbeat-service", () => ({
  processHeartbeat: processHeartbeatMock,
}));
vi.mock("@/lib/heartbeat-alerts", () => ({
  maybeDispatchHeartbeatAlerts: maybeDispatchHeartbeatAlertsMock,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    visit: { findFirst: visitFindFirstMock },
  },
}));
vi.mock("@/lib/security", () => ({
  checkRateLimit: checkRateLimitMock,
  extractTokenFromBody: (body: Record<string, unknown>) =>
    typeof body.token === "string" ? body.token : null,
  parseTimestamp: (value: unknown) =>
    typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value) : null,
  resolveRequestAppOrigin: () => "https://office-tracker-theta.vercel.app",
  sanitizeAgentApiUrl: () => null,
  sanitizeScriptVersion: (value: unknown) => (typeof value === "string" ? value : null),
  sanitizeSsid: (value: unknown) => (typeof value === "string" ? value : null),
  sanitizeSerialNumber: (value: unknown) => (typeof value === "string" ? value : null),
  sanitizeVpnGateway: () => null,
}));

import { POST as postHeartbeat } from "@/app/api/heartbeat/route";

function heartbeatRequest(body: Record<string, unknown>) {
  return postHeartbeat(
    new Request("https://office-tracker-theta.vercel.app/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    authenticateAgentTokenMock.mockResolvedValue({
      ok: true,
      userId: "user-1",
      agentTokenId: "token-1",
      agentToken: { tokenPrefix: "abc" },
    });
    bindAgentTokenToSerialMock.mockResolvedValue({ ok: true, newlyBound: false });
    registerOrUpdateDeviceMock.mockResolvedValue({
      ok: true,
      registered: false,
      device: { id: "device-1" },
    });
    getUserByAgentTokenMock.mockResolvedValue({ id: "user-1", timezone: "Asia/Kolkata" });
    backfillInstallTokenEncIfNeededMock.mockResolvedValue(undefined);
    recordHeartbeatLifecycleMock.mockResolvedValue(undefined);
    recordDeviceScriptVersionMock.mockResolvedValue(undefined);
    visitFindFirstMock.mockResolvedValue(null);
  });

  it("skips processHeartbeat in events mode and returns sync redirect", async () => {
    getAppConfigMock.mockResolvedValue({ agentMode: "events", officeSsids: ["OfficeConnect"] });

    const response = await heartbeatRequest({
      token: "agent-token",
      serialNumber: "SERIAL-1",
      at: "2026-09-12T10:00:00.000Z",
      ssid: "OfficeConnect",
      scriptVersion: "1.3.0",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      inOffice: false,
      mode: "events",
      message: "Use /api/agent/sync",
      deviceRegistered: false,
      tokenBound: false,
    });
    expect(processHeartbeatMock).not.toHaveBeenCalled();
    expect(maybeDispatchHeartbeatAlertsMock).not.toHaveBeenCalled();
    expect(recordHeartbeatLifecycleMock).toHaveBeenCalled();
    expect(recordDeviceScriptVersionMock).toHaveBeenCalledWith("user-1", "SERIAL-1", "1.3.0");
  });

  it("derives inOffice from open visit in events mode", async () => {
    getAppConfigMock.mockResolvedValue({ agentMode: "events", officeSsids: ["OfficeConnect"] });
    visitFindFirstMock.mockResolvedValue({ id: "visit-1", endAt: null });

    const response = await heartbeatRequest({
      token: "agent-token",
      serialNumber: "SERIAL-1",
      at: "2026-09-12T10:00:00.000Z",
      ssid: "OfficeConnect",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.inOffice).toBe(true);
    expect(body.mode).toBe("events");
    expect(processHeartbeatMock).not.toHaveBeenCalled();
  });

  it("keeps heartbeat processing when agentMode is heartbeat", async () => {
    getAppConfigMock.mockResolvedValue({ agentMode: "heartbeat", officeSsids: ["OfficeConnect"] });
    processHeartbeatMock.mockResolvedValue({ inOffice: true });

    const response = await heartbeatRequest({
      token: "agent-token",
      serialNumber: "SERIAL-1",
      at: "2026-09-12T10:00:00.000Z",
      ssid: "OfficeConnect",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      inOffice: true,
      deviceRegistered: false,
      tokenBound: false,
    });
    expect(processHeartbeatMock).toHaveBeenCalledWith({
      userId: "user-1",
      ssid: "OfficeConnect",
      vpnGateway: null,
      recordedAt: new Date("2026-09-12T10:00:00.000Z"),
      allowlist: ["OfficeConnect"],
    });
  });
});
