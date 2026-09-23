import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationAlert } from "@/lib/integration-alerts";

const {
  getIntegrationAlerts,
  getIntegrationAlertsForUser,
  persistInAppAlerts,
  acknowledgeIntegrationAlerts,
} = vi.hoisted(() => ({
  getIntegrationAlerts: vi.fn(),
  getIntegrationAlertsForUser: vi.fn(),
  persistInAppAlerts: vi.fn(),
  acknowledgeIntegrationAlerts: vi.fn(),
}));

vi.mock("@/lib/integration-alerts", () => ({
  getIntegrationAlerts,
  getIntegrationAlertsForUser,
  acknowledgeIntegrationAlerts,
}));

vi.mock("@/lib/in-app-notifications", () => ({
  persistInAppAlerts,
}));

import { dispatchUserAlerts } from "@/lib/power-automate-notify";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/webhook-missing-ack.json"), "utf8"),
) as {
  bothChannelAlert: { type: string; deliveryChannel: string; notifyTeams: boolean; dayKey: string };
  teamsOnlyAlert: { type: string; deliveryChannel: string; notifyTeams: boolean; dayKey: string };
};

const baseAlert: Omit<
  IntegrationAlert,
  "type" | "message" | "deliveryChannel" | "notifyTeams"
> = {
  userId: "user-a",
  email: "usera@example.com",
  name: "UserA",
  hoursToday: 1,
  hoursTarget: 5,
  agentHealthy: true,
  inOfficeNow: true,
  dayKey: "2026-09-07",
  dashboardUrl: "https://pulse.example/dashboard",
  settingsUrl: "https://pulse.example/settings",
  helpUrl: "https://pulse.example/help",
  outOfOfficeUrl: "https://pulse.example/out-of-office",
};

describe("BUG-006 webhook missing must not block in-app ack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistInAppAlerts.mockResolvedValue(1);
    acknowledgeIntegrationAlerts.mockResolvedValue(undefined);
  });

  it("acknowledges both-channel alerts when webhook is null", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: fixture.bothChannelAlert.type,
        message: "Hours started",
        deliveryChannel: fixture.bothChannelAlert.deliveryChannel,
        notifyTeams: fixture.bothChannelAlert.notifyTeams,
        dayKey: fixture.bothChannelAlert.dayKey,
      },
    ]);

    const result = await dispatchUserAlerts("user-a", ["hours_started"], {
      webhookUrl: null,
      fetcher: vi.fn(),
    });

    expect(persistInAppAlerts).toHaveBeenCalledTimes(1);
    expect(acknowledgeIntegrationAlerts).toHaveBeenCalledWith(
      "user-a",
      [expect.objectContaining({ type: "hours_started", dayKey: fixture.bothChannelAlert.dayKey })],
    );
    expect(result).toMatchObject({ configured: false, sent: 0, inApp: 1 });
  });

  it("leaves teams-only alerts pending when webhook is null", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: fixture.teamsOnlyAlert.type,
        message: "Hours met",
        deliveryChannel: fixture.teamsOnlyAlert.deliveryChannel,
        notifyTeams: fixture.teamsOnlyAlert.notifyTeams,
        dayKey: fixture.teamsOnlyAlert.dayKey,
      },
    ]);

    const result = await dispatchUserAlerts("user-a", ["hours_met"], {
      webhookUrl: null,
      fetcher: vi.fn(),
    });

    expect(persistInAppAlerts).not.toHaveBeenCalled();
    expect(acknowledgeIntegrationAlerts).not.toHaveBeenCalled();
    expect(result).toMatchObject({ configured: false, sent: 0, inApp: 0 });
  });
});
