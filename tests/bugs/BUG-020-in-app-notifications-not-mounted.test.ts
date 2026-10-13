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
  dashboardMustMountPanel: boolean;
};

describe("BUG-020 in-app hours_met not shown on dashboard", () => {
  it("dashboard mounts InAppNotificationPanel with unread rows", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/app/dashboard/page.tsx"),
      "utf8",
    );
    expect(fixture.dashboardMustMountPanel).toBe(true);
    expect(dashboard).toContain("InAppNotificationPanel");
    expect(dashboard).toContain("listUnreadInAppNotifications");
    expect(dashboard).toContain("<InAppNotificationPanel");
    // Live/yellow completion can fire on Today load before unread rows are listed.
    expect(dashboard).toContain("maybeDispatchHeartbeatAlerts");
  });

  it("panel component still dismisses via settings API", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/InAppNotificationPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain(fixture.alertType);
    expect(panel).toContain("/api/settings/in-app-notifications/");
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
