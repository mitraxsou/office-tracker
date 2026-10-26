import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, findFirst, update, findMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    inAppNotification: {
      updateMany,
      findFirst,
      update,
      findUnique: vi.fn(),
      findMany,
      create: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/timezone-dates", () => ({
  dayKeyInTimezone: () => "2026-10-26",
}));

import {
  AUTO_DISMISS_IN_APP_TYPES,
  IN_APP_AUTO_DISMISS_MS,
  dismissAllUnreadInAppNotifications,
  dismissInAppNotification,
  dismissUnreadInAppNotificationsNotForDay,
  isAutoDismissInAppType,
  listTodayUnreadInAppNotifications,
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

describe("dismissUnreadInAppNotificationsNotForDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-reads unread rows whose dayKey is not today", async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const count = await dismissUnreadInAppNotificationsNotForDay(
      "user-1",
      "2026-10-26",
    );
    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        readAt: null,
        NOT: { dayKey: "2026-10-26" },
      },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe("listTodayUnreadInAppNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prunes other days then returns only today's unread", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findMany.mockResolvedValue([
      {
        id: "n-today",
        type: "hours_started",
        dayKey: "2026-10-26",
        message: "Office Wi-Fi detected.",
        createdAt: new Date("2026-10-26T08:00:00.000Z"),
      },
    ]);

    const rows = await listTodayUnreadInAppNotifications("user-1", "Asia/Kolkata");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        readAt: null,
        NOT: { dayKey: "2026-10-26" },
      },
      data: { readAt: expect.any(Date) },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", readAt: null, dayKey: "2026-10-26" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    expect(rows).toEqual([
      {
        id: "n-today",
        type: "hours_started",
        dayKey: "2026-10-26",
        message: "Office Wi-Fi detected.",
        createdAt: "2026-10-26T08:00:00.000Z",
      },
    ]);
  });
});
