import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationAlert } from "../src/lib/integration-alerts";

const {
  getIntegrationAlertsForUser,
  persistInAppAlerts,
  acknowledgeIntegrationAlerts,
} = vi.hoisted(() => ({
  getIntegrationAlertsForUser: vi.fn(),
  persistInAppAlerts: vi.fn(),
  acknowledgeIntegrationAlerts: vi.fn(),
}));

vi.mock("../src/lib/integration-alerts", () => ({
  getIntegrationAlertsForUser,
  acknowledgeIntegrationAlerts,
}));

vi.mock("../src/lib/in-app-notifications", () => ({
  persistInAppAlerts,
}));

import { dispatchUserAlerts } from "../src/lib/power-automate-notify";

const baseAlert: Omit<IntegrationAlert, "type" | "message" | "deliveryChannel" | "notifyTeams"> = {
  userId: "user-1",
  email: "user@example.com",
  name: "User",
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

describe("dispatchUserAlerts delivery channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistInAppAlerts.mockResolvedValue(1);
    acknowledgeIntegrationAlerts.mockResolvedValue(undefined);
  });

  it("persists in-app and posts webhook when channel is both", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: "hours_started",
        message: "Hours started",
        deliveryChannel: "both",
        notifyTeams: true,
      },
    ]);

    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const markUsed = vi.fn().mockResolvedValue(undefined);
    const result = await dispatchUserAlerts("user-1", ["hours_started"], {
      webhookUrl: "https://example.invalid/webhook",
      getSecret: async () => ({ id: "key-1", actorId: "admin-1", secret: "header-secret" }),
      fetcher,
      markUsed,
    });

    expect(persistInAppAlerts).toHaveBeenCalledWith([
      expect.objectContaining({ deliveryChannel: "both" }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ configured: true, sent: 1, inApp: 1 });
  });

  it("persists in-app only when channel is app", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: "absent",
        message: "Absent",
        deliveryChannel: "app",
        notifyTeams: false,
      },
    ]);

    const fetcher = vi.fn();
    const result = await dispatchUserAlerts("user-1", ["absent"], {
      webhookUrl: "https://example.invalid/webhook",
      getSecret: async () => ({ id: "key-1", actorId: "admin-1", secret: "header-secret" }),
      fetcher,
    });

    expect(persistInAppAlerts).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, inApp: 1 });
  });
});
