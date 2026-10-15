import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  AUTO_DISMISS_IN_APP_TYPES,
  IN_APP_AUTO_DISMISS_MS,
  isAutoDismissInAppType,
} from "../../src/lib/in-app-notifications";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/in-app-notify-hybrid-ux.json"),
    "utf8",
  ),
) as {
  autoDismissTypes: string[];
  urgentTypes: string[];
  autoDismissMs: number;
  clearAllPath: string;
  singleDismissPathPrefix: string;
};

describe("BUG-021 in-app notify hybrid UX (auto-dismiss + clear all)", () => {
  it("classifies success vs urgent types for auto-dismiss", () => {
    expect(IN_APP_AUTO_DISMISS_MS).toBe(fixture.autoDismissMs);
    for (const type of fixture.autoDismissTypes) {
      expect(isAutoDismissInAppType(type)).toBe(true);
      expect(AUTO_DISMISS_IN_APP_TYPES as readonly string[]).toContain(type);
    }
    for (const type of fixture.urgentTypes) {
      expect(isAutoDismissInAppType(type)).toBe(false);
    }
  });

  it("panel schedules auto-dismiss and offers Clear all", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/InAppNotificationPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("IN_APP_AUTO_DISMISS_MS");
    expect(panel).toContain("isAutoDismissInAppType");
    expect(panel).toContain("Clear all");
    expect(panel).toContain(fixture.clearAllPath);
    expect(panel).toContain(fixture.singleDismissPathPrefix);
  });

  it("dismiss-all API route marks all unread read", () => {
    const route = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/settings/in-app-notifications/route.ts",
      ),
      "utf8",
    );
    expect(route).toContain("dismissAllUnreadInAppNotifications");
    expect(route).toContain("export async function POST");
  });
});
