import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationAlert } from "../src/lib/integration-alerts";

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

vi.mock("../src/lib/integration-alerts", () => ({
  getIntegrationAlerts,
  getIntegrationAlertsForUser,
  acknowledgeIntegrationAlerts,
}));

vi.mock("../src/lib/in-app-notifications", () => ({
  persistInAppAlerts,
}));

import { dispatchPendingAlerts, dispatchUserAlerts } from "../src/lib/power-automate-notify";

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

describe("dispatchPendingAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntegrationAlerts.mockResolvedValue({ generatedAt: new Date().toISOString(), alerts: [] });
  });

  it("evaluates positive office alerts on the daily cron", async () => {
    await dispatchPendingAlerts({ webhookUrl: null });

    expect(getIntegrationAlerts).toHaveBeenCalledWith(
      "hours_started,hours_met,monthly_snapshot",
    );
  });
});

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
    expect(acknowledgeIntegrationAlerts).toHaveBeenCalledWith("admin-1", [
      expect.objectContaining({ userId: "user-1", type: "hours_started", dayKey: "2026-09-07" }),
    ]);
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
    expect(acknowledgeIntegrationAlerts).toHaveBeenCalledWith("admin-1", [
      expect.objectContaining({ userId: "user-1", type: "absent", dayKey: "2026-09-07" }),
    ]);
    expect(result).toMatchObject({ sent: 0, inApp: 1 });
  });

  it("does not acknowledge when Teams delivery fails for a both-channel alert", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: "hours_met",
        message: "Hours met",
        deliveryChannel: "both",
        notifyTeams: true,
      },
    ]);

    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await dispatchUserAlerts("user-1", ["hours_met"], {
      webhookUrl: "https://example.invalid/webhook",
      getSecret: async () => ({ id: "key-1", actorId: "admin-1", secret: "header-secret" }),
      fetcher,
    });

    expect(persistInAppAlerts).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(acknowledgeIntegrationAlerts).not.toHaveBeenCalled();
    expect(result).toMatchObject({ configured: true, sent: 0, failed: 1, inApp: 1 });
  });

  it("acknowledges the in-app copy when no webhook is configured", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: "hours_started",
        message: "Hours started",
        deliveryChannel: "both",
        notifyTeams: true,
      },
    ]);

    const fetcher = vi.fn();
    const result = await dispatchUserAlerts("user-1", ["hours_started"], {
      webhookUrl: null,
      fetcher,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(persistInAppAlerts).toHaveBeenCalledTimes(1);
    expect(acknowledgeIntegrationAlerts).toHaveBeenCalledWith("user-1", [
      expect.objectContaining({ userId: "user-1", type: "hours_started", dayKey: "2026-09-07" }),
    ]);
    expect(result).toMatchObject({ configured: false, sent: 0, inApp: 1 });
  });

  it("leaves a teams-only alert pending when no webhook is configured", async () => {
    getIntegrationAlertsForUser.mockResolvedValue([
      {
        ...baseAlert,
        type: "hours_met",
        message: "Hours met",
        deliveryChannel: "teams",
        notifyTeams: true,
      },
    ]);

    const result = await dispatchUserAlerts("user-1", ["hours_met"], {
      webhookUrl: null,
      fetcher: vi.fn(),
    });

    expect(persistInAppAlerts).not.toHaveBeenCalled();
    expect(acknowledgeIntegrationAlerts).not.toHaveBeenCalled();
    expect(result).toMatchObject({ configured: false, sent: 0, inApp: 0 });
  });
});
