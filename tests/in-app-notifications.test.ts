import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, findFirst, update } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    inAppNotification: {
      updateMany,
      findFirst,
      update,
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import {
  AUTO_DISMISS_IN_APP_TYPES,
  IN_APP_AUTO_DISMISS_MS,
  dismissAllUnreadInAppNotifications,
  dismissInAppNotification,
  isAutoDismissInAppType,
} from "../src/lib/in-app-notifications";

describe("in-app notification auto-dismiss types", () => {
  it("marks success-style alerts for auto-dismiss", () => {
    expect(IN_APP_AUTO_DISMISS_MS).toBe(12_000);
    for (const type of [
      "hours_started",
      "hours_met",
      "monthly_snapshot",
      "ooo_cleared",
    ]) {
      expect(isAutoDismissInAppType(type)).toBe(true);
      expect(AUTO_DISMISS_IN_APP_TYPES).toContain(type);
    }
  });

  it("keeps urgent and admin-contact types until manual dismiss", () => {
    for (const type of [
      "absent",
      "stale",
      "behind",
      "custom",
      "admin_contact_message",
      "admin_contact_closed",
      "admin_contact_reopened",
    ]) {
      expect(isAutoDismissInAppType(type)).toBe(false);
    }
  });
});

describe("dismissAllUnreadInAppNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-reads every unread row for the user", async () => {
    updateMany.mockResolvedValue({ count: 3 });
    const count = await dismissAllUnreadInAppNotifications("user-1");
    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe("dismissInAppNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when row is missing", async () => {
    findFirst.mockResolvedValue(null);
    await expect(dismissInAppNotification("user-1", "n1")).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("sets readAt when unread row exists", async () => {
    findFirst.mockResolvedValue({ id: "n1", userId: "user-1" });
    update.mockResolvedValue({});
    await expect(dismissInAppNotification("user-1", "n1")).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { readAt: expect.any(Date) },
    });
  });
});
