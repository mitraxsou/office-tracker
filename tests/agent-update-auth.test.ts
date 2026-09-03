import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.hoisted(() => vi.fn());
const requestDeviceUpdateMock = vi.hoisted(() => vi.fn());
const requestUserUpdateMock = vi.hoisted(() => vi.fn());
const auditMock = vi.hoisted(() => vi.fn());
const deviceFindMock = vi.hoisted(() => vi.fn());
const userFindMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/agent-update", () => ({
  requestAgentUpdateForDevice: requestDeviceUpdateMock,
  requestAgentUpdateForUser: requestUserUpdateMock,
}));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: auditMock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentDevice: { findUnique: deviceFindMock },
    user: { findUnique: userFindMock },
  },
}));

import { POST as pushDeviceUpdate } from "@/app/api/admin/devices/[id]/agent-update/route";
import { POST as pushUserUpdate } from "@/app/api/admin/users/[id]/agent-update/route";

describe("admin agent update authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(null);
  });

  it("rejects non-admin device update requests before database access", async () => {
    const response = await pushDeviceUpdate(new Request("https://office.example"), {
      params: Promise.resolve({ id: "device-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(deviceFindMock).not.toHaveBeenCalled();
    expect(requestDeviceUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin user update requests before database access", async () => {
    const response = await pushUserUpdate(new Request("https://office.example"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(userFindMock).not.toHaveBeenCalled();
    expect(requestUserUpdateMock).not.toHaveBeenCalled();
  });

  it("allows an admin to queue a device update", async () => {
    requireAdminMock.mockResolvedValue({ id: "admin-1" });
    deviceFindMock.mockResolvedValue({
      id: "device-1",
      userId: "user-1",
      serialNumber: "SERIAL-1",
      uninstalledAt: null,
    });

    const response = await pushDeviceUpdate(new Request("https://office.example"), {
      params: Promise.resolve({ id: "device-1" }),
    });

    expect(response.status).toBe(200);
    expect(requestDeviceUpdateMock).toHaveBeenCalledWith("device-1");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", action: "agent_update_push" }),
    );
  });

  it("allows an admin to queue updates for a user", async () => {
    requireAdminMock.mockResolvedValue({ id: "admin-1" });
    userFindMock.mockResolvedValue({ id: "user-1" });
    requestUserUpdateMock.mockResolvedValue(2);

    const response = await pushUserUpdate(new Request("https://office.example"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, deviceCount: 2 });
    expect(requestUserUpdateMock).toHaveBeenCalledWith("user-1");
  });
});
