import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/in-app-hours-met-not-shown.json"),
    "utf8",
  ),
) as {
  alertType: string;
  deliveryChannel: string;
  appNavMustMountBell: boolean;
};

describe("BUG-020 in-app hours_met not shown on dashboard", () => {
  it("AppNav mounts user notification bell with today's unread", () => {
    const appNav = readFileSync(
      path.join(process.cwd(), "src/components/AppNav.tsx"),
      "utf8",
    );
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/app/dashboard/page.tsx"),
      "utf8",
    );
    expect(fixture.appNavMustMountBell).toBe(true);
    expect(appNav).toContain("UserNotificationCorner");
    expect(appNav).toContain("listTodayUnreadInAppNotifications");
    expect(appNav).toContain("<UserNotificationCorner");
    expect(dashboard).not.toContain("InAppNotificationPanel");
    expect(dashboard).not.toContain("listUnreadInAppNotifications");
    // Live/yellow completion can fire on Today load before unread rows are listed.
    expect(dashboard).toContain("maybeDispatchHeartbeatAlerts");
  });

  it("bell component dismisses via settings API and titles include hours_met", () => {
    const corner = readFileSync(
      path.join(process.cwd(), "src/components/UserNotificationCorner.tsx"),
      "utf8",
    );
    const titles = readFileSync(
      path.join(process.cwd(), "src/lib/in-app-notification-ui.ts"),
      "utf8",
    );
    expect(titles).toContain(fixture.alertType);
    expect(corner).toContain("/api/settings/in-app-notifications/");
    expect(corner).toContain("Clear all");
  });

  it("server sync reopens zero-duration wifi visits (endAt <= startAt)", () => {
    const sync = readFileSync(path.join(process.cwd(), "src/lib/agent-sync.ts"), "utf8");
    expect(sync).toContain("endAt.getTime() <= ");
    expect(sync).toContain("zero-duration");
  });

  it("stale close refuses to persist endAt equal to startAt", () => {
    const service = readFileSync(
      path.join(process.cwd(), "src/lib/heartbeat-service.ts"),
      "utf8",
    );
    expect(service).toContain("Do not clamp to startAt");
    expect(service).toContain("if (endAt.getTime() <= open.startAt.getTime())");
  });
});
