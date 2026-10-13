import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectHeartbeatAlertTypes } from "../src/lib/heartbeat-alerts";
import { liveOfficeMsForDay } from "../src/lib/visits";
import { VISIT_GAP_MS } from "../src/lib/constants";

const { maybeClearOutOfOfficeOnOfficePresence } = vi.hoisted(() => ({
  maybeClearOutOfOfficeOnOfficePresence: vi.fn(),
}));

const { dispatchUserAlerts } = vi.hoisted(() => ({
  dispatchUserAlerts: vi.fn(),
}));

const { filterUndispatchedAlertTypes } = vi.hoisted(() => ({
  filterUndispatchedAlertTypes: vi.fn(),
}));

const { wasAlertDispatchedToday } = vi.hoisted(() => ({
  wasAlertDispatchedToday: vi.fn(),
}));

const { getQuickMetTarget } = vi.hoisted(() => ({
  getQuickMetTarget: vi.fn(),
}));

vi.mock("../src/lib/out-of-office", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/out-of-office")>();
  return {
    ...actual,
    maybeClearOutOfOfficeOnOfficePresence,
  };
});

vi.mock("../src/lib/power-automate-notify", () => ({
  dispatchUserAlerts,
}));

vi.mock("../src/lib/alert-dispatch", () => ({
  filterUndispatchedAlertTypes,
  wasAlertDispatchedToday,
}));

vi.mock("../src/lib/heartbeat-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/heartbeat-service")>();
  return {
    ...actual,
    getQuickMetTarget,
  };
});

import { handleOfficePresenceDetected } from "../src/lib/ooo-presence";
import { maybeDispatchHeartbeatAlerts } from "../src/lib/heartbeat-alerts";

const ms = (minutes: number) => minutes * 60 * 1000;

describe("notification scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchUserAlerts.mockResolvedValue({ ok: true });
    filterUndispatchedAlertTypes.mockImplementation(async (_u, _d, types) => types);
    maybeClearOutOfOfficeOnOfficePresence.mockResolvedValue({
      cleared: false,
      dayKey: "2026-10-13",
    });
    wasAlertDispatchedToday.mockResolvedValue(false);
    getQuickMetTarget.mockResolvedValue(false);
  });

  describe("1. Manual check-in → hours_started path", () => {
    it("admin/manual presence handler queues hours_started without a delay gate", async () => {
      await handleOfficePresenceDetected("user-1", "Asia/Kolkata");

      expect(filterUndispatchedAlertTypes).toHaveBeenCalledWith(
        "user-1",
        expect.any(String),
        expect.arrayContaining(["hours_started", "monthly_snapshot", "hours_met"]),
      );
      expect(dispatchUserAlerts).toHaveBeenCalledTimes(1);
      expect(dispatchUserAlerts).toHaveBeenCalledWith(
        "user-1",
        expect.arrayContaining(["hours_started"]),
      );
    });

    it("check-in route wires handleOfficePresenceDetected for admin open visits", () => {
      const route = readFileSync(
        path.join(process.cwd(), "src/app/api/visits/check-in/route.ts"),
        "utf8",
      );
      expect(route).toContain("handleOfficePresenceDetected");
      expect(route).toContain("checkInOffice");
      expect(route).not.toContain("setTimeout");
    });

    it("manual visit approval with open endAt fires office presence notifications", () => {
      const manual = readFileSync(
        path.join(process.cwd(), "src/lib/manual-visit-requests.ts"),
        "utf8",
      );
      expect(manual).toContain("handleOfficePresenceDetected");
      expect(manual).toContain("if (!existing.endAt)");
    });
  });

  describe("2. Agent detection → hours_started on visit_start / wifi / heartbeat", () => {
    it("selectHeartbeatAlertTypes queues hours_started on first in-office beat", () => {
      expect(
        selectHeartbeatAlertTypes({
          inOffice: true,
          oooCleared: false,
          metTarget: false,
          hoursStartedSent: false,
          hoursMetSent: false,
          monthlySnapshotSent: true,
        }),
      ).toEqual(["hours_started"]);
    });

    it("still queues hours_started after sync already wrote today's visit", () => {
      expect(
        selectHeartbeatAlertTypes({
          inOffice: true,
          oooCleared: false,
          metTarget: false,
          hoursStartedSent: false,
          hoursMetSent: true,
          monthlySnapshotSent: true,
        }),
      ).toEqual(["hours_started"]);
    });

    it("agent-sync and heartbeat routes call maybeDispatchHeartbeatAlerts in-process", () => {
      const sync = readFileSync(path.join(process.cwd(), "src/lib/agent-sync.ts"), "utf8");
      const heartbeat = readFileSync(
        path.join(process.cwd(), "src/app/api/heartbeat/route.ts"),
        "utf8",
      );
      expect(sync).toContain("await maybeDispatchHeartbeatAlerts({");
      expect(sync).toContain("visit_start");
      expect(sync).toContain("wifi_connected");
      expect(sync).toContain("hours_target_met");
      expect(heartbeat).toContain("await maybeDispatchHeartbeatAlerts({");
      expect(sync).not.toMatch(/setTimeout\s*\(\s*.*maybeDispatchHeartbeatAlerts/);
      expect(heartbeat).not.toMatch(/setTimeout\s*\(\s*.*maybeDispatchHeartbeatAlerts/);
    });

    it("maybeDispatchHeartbeatAlerts dispatches hours_started ASAP when in office", async () => {
      await maybeDispatchHeartbeatAlerts({
        userId: "user-1",
        timezone: "Asia/Kolkata",
        recordedAt: new Date("2026-10-13T04:00:00.000Z"),
        inOffice: true,
        hoursTarget: 5,
      });

      expect(getQuickMetTarget).toHaveBeenCalled();
      expect(dispatchUserAlerts).toHaveBeenCalledWith(
        "user-1",
        expect.arrayContaining(["hours_started"]),
      );
    });
  });

  describe("3. Yellow / live hours_met without recent agent sync", () => {
    it("queues hours_met from live metTarget even when not flagged in-office", () => {
      // Agent silent or hours_target_met sync: completion uses live day total.
      expect(
        selectHeartbeatAlertTypes({
          inOffice: false,
          oooCleared: false,
          metTarget: true,
          hoursStartedSent: true,
          hoursMetSent: false,
          monthlySnapshotSent: true,
        }),
      ).toEqual(["hours_met"]);
    });

    it("live office ms stretches past last confirmation while still in office (yellow)", () => {
      const dayStart = new Date("2026-10-13T00:00:00+05:30");
      const dayEnd = new Date("2026-10-13T23:59:59.999+05:30");
      const entered = new Date("2026-10-13T09:00:00+05:30");
      const confirmed = new Date("2026-10-13T13:30:00+05:30");
      const now = new Date("2026-10-13T14:05:00+05:30");
      const visits = [
        {
          id: "1",
          startAt: entered,
          endAt: null,
          source: "wifi",
          updatedAt: confirmed,
        },
      ];
      const params = {
        dayStart,
        dayEnd,
        now,
        staleMs: VISIT_GAP_MS,
        lastHeartbeatAt: confirmed,
        firstInOfficeHeartbeatAt: entered,
        lastInOfficeHeartbeatAt: confirmed,
      };
      const liveMs = liveOfficeMsForDay(visits, params, true);
      const liveHours = liveMs / (1000 * 60 * 60);
      expect(liveHours).toBeCloseTo(5 + 5 / 60, 5);
      expect(liveHours).toBeGreaterThanOrEqual(5);
      expect(
        selectHeartbeatAlertTypes({
          inOffice: true,
          oooCleared: false,
          metTarget: liveHours >= 5,
          hoursStartedSent: true,
          hoursMetSent: false,
          monthlySnapshotSent: true,
        }),
      ).toEqual(["hours_met"]);
    });

    it("accepts precomputed metTarget so dashboard can fire without re-query", async () => {
      wasAlertDispatchedToday.mockImplementation(async (_u, type) => type !== "hours_met");

      await maybeDispatchHeartbeatAlerts({
        userId: "user-1",
        timezone: "Asia/Kolkata",
        recordedAt: new Date("2026-10-13T08:40:00.000Z"),
        inOffice: false,
        hoursTarget: 5,
        metTarget: true,
      });

      expect(getQuickMetTarget).not.toHaveBeenCalled();
      expect(dispatchUserAlerts).toHaveBeenCalledWith("user-1", ["hours_met"]);
    });

    it("dashboard Today load evaluates alerts from liveHours before listing in-app rows", () => {
      const dashboard = readFileSync(
        path.join(process.cwd(), "src/app/dashboard/page.tsx"),
        "utf8",
      );
      expect(dashboard).toContain("maybeDispatchHeartbeatAlerts");
      expect(dashboard).toContain("metTarget: summary.metTarget");
      expect(dashboard).toContain("summary.inOfficeNow || summary.metTarget");
      const alertIdx = dashboard.indexOf("maybeDispatchHeartbeatAlerts");
      const unreadIdx = dashboard.indexOf("listUnreadInAppNotifications");
      expect(alertIdx).toBeGreaterThan(-1);
      expect(unreadIdx).toBeGreaterThan(alertIdx);
    });
  });

  describe("4. Office in ASAP (no long delay before hours_started)", () => {
    it("presence handler awaits dispatchUserAlerts in the same call stack", async () => {
      const order: string[] = [];
      filterUndispatchedAlertTypes.mockImplementation(async (_u, _d, types) => {
        order.push("filter");
        return types;
      });
      dispatchUserAlerts.mockImplementation(async () => {
        order.push("dispatch");
        return { ok: true };
      });

      await handleOfficePresenceDetected("user-1", "Asia/Kolkata");

      expect(order).toEqual(["filter", "dispatch"]);
    });

    it("heartbeat alert helper has no sleep/delay before dispatch", () => {
      const source = readFileSync(
        path.join(process.cwd(), "src/lib/heartbeat-alerts.ts"),
        "utf8",
      );
      const presence = readFileSync(
        path.join(process.cwd(), "src/lib/ooo-presence.ts"),
        "utf8",
      );
      expect(source).not.toContain("setTimeout");
      expect(source).not.toContain("setInterval");
      expect(source).not.toMatch(/sleep\s*\(/);
      expect(presence).not.toContain("setTimeout");
      expect(presence).toContain("await dispatchUserAlerts");
    });

    it("in-office beat with nothing sent yet queues hours_started (and snapshot) immediately", () => {
      expect(
        selectHeartbeatAlertTypes({
          inOffice: true,
          oooCleared: false,
          metTarget: false,
          hoursStartedSent: false,
          hoursMetSent: false,
          monthlySnapshotSent: false,
        }),
      ).toEqual(["hours_started", "monthly_snapshot"]);
    });
  });
});

describe("notification scenario helpers stay aligned with visit gap", () => {
  it("yellow stretch uses the same gap constant as visit maintenance", () => {
    expect(VISIT_GAP_MS).toBe(ms(15));
  });
});
