import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUser: vi.fn(),
  logAuditEvent: vi.fn(),
  sendCustomUserNotification: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUser,
    },
  },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/custom-notification", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/custom-notification")>();
  return {
    ...original,
    sendCustomUserNotification: mocks.sendCustomUserNotification,
  };
});

import { POST } from "../src/app/api/admin/users/[id]/custom-notification/route";

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "Alex",
  timezone: "Asia/Kolkata",
};

function request(body: unknown) {
  return new Request("https://pulse.example/api/admin/users/user-1/custom-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin custom notification route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(null);
    mocks.findUser.mockResolvedValue(user);
    mocks.logAuditEvent.mockResolvedValue({});
    mocks.sendCustomUserNotification.mockResolvedValue({
      inApp: true,
      teams: { sent: false },
    });
  });

  it("forbids a non-admin", async () => {
    const response = await POST(request({ message: "Hello", channel: "app" }), {
      params: Promise.resolve({ id: "user-1" }),
    });
    expect(response.status).toBe(403);
    expect(mocks.sendCustomUserNotification).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    const response = await POST(request({ message: "   ", channel: "app" }), {
      params: Promise.resolve({ id: "user-1" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.sendCustomUserNotification).not.toHaveBeenCalled();
  });

  it("sends an in-app notification and writes an audit log", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    const response = await POST(request({ message: "Please update the agent.", channel: "app" }), {
      params: Promise.resolve({ id: "user-1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.sendCustomUserNotification).toHaveBeenCalledWith(
      user,
      "Please update the agent.",
      "app",
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "admin_custom_notification",
        targetUserId: "user-1",
      }),
    );
  });

  it("returns 502 when Teams-only delivery is not configured", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.sendCustomUserNotification.mockResolvedValue({
      inApp: false,
      teams: { sent: false, reason: "not_configured" },
    });
    const response = await POST(request({ message: "Hello", channel: "teams" }), {
      params: Promise.resolve({ id: "user-1" }),
    });
    expect(response.status).toBe(502);
  });
});
