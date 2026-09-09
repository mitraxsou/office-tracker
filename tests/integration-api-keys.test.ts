import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  generateIntegrationApiKey,
} from "../src/lib/integration-api-keys";
import { dispatchAlert, postWebhookPayload } from "../src/lib/power-automate-notify";
import type { IntegrationAlert } from "../src/lib/integration-alerts";

const alert: IntegrationAlert = {
  type: "hours_started",
  userId: "user-1",
  email: "admin@example.com",
  name: "Admin",
  message: "Test message",
  hoursToday: 1,
  hoursTarget: 5,
  agentHealthy: true,
  inOfficeNow: true,
  notifyTeams: true,
  deliveryChannel: "teams",
  dayKey: "2026-09-04",
  dashboardUrl: "https://pulse.example/dashboard",
  settingsUrl: "https://pulse.example/settings",
  helpUrl: "https://pulse.example/help",
  outOfOfficeUrl: "https://pulse.example/out-of-office",
};

describe("Power Automate webhook secrets", () => {
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalWebhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  const originalWebhookSecret = process.env.POWER_AUTOMATE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    delete process.env.POWER_AUTOMATE_WEBHOOK_URL;
    delete process.env.POWER_AUTOMATE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;
    if (originalWebhookUrl === undefined) delete process.env.POWER_AUTOMATE_WEBHOOK_URL;
    else process.env.POWER_AUTOMATE_WEBHOOK_URL = originalWebhookUrl;
    if (originalWebhookSecret === undefined) delete process.env.POWER_AUTOMATE_WEBHOOK_SECRET;
    else process.env.POWER_AUTOMATE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("generates a 32-byte hex secret", () => {
    expect(generateIntegrationApiKey()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("encrypts and decrypts a secret with AUTH_SECRET", () => {
    const plain = generateIntegrationApiKey();
    const encrypted = encryptIntegrationSecret(plain);
    expect(encrypted).not.toContain(plain);
    expect(decryptIntegrationSecret(encrypted)).toBe(plain);
  });

  it("rejects encrypted data after AUTH_SECRET changes", () => {
    const encrypted = encryptIntegrationSecret("shared-secret");
    process.env.AUTH_SECRET = "a-different-auth-secret-that-is-long-enough";
    expect(decryptIntegrationSecret(encrypted)).toBeNull();
  });

  it("skips dispatch when the webhook URL is missing", async () => {
    const getSecret = vi.fn();
    const fetcher = vi.fn();
    const result = await dispatchAlert(alert, { getSecret, fetcher });
    expect(result).toMatchObject({ sent: false, skipped: true, reason: "not_configured" });
    expect(getSecret).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("skips dispatch when no active secret exists", async () => {
    const fetcher = vi.fn();
    const result = await dispatchAlert(alert, {
      webhookUrl: "https://example.invalid/webhook",
      getSecret: async () => null,
      fetcher,
    });
    expect(result).toMatchObject({ sent: false, skipped: true, reason: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts the token as a header without userId in the body", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const markUsed = vi.fn().mockResolvedValue(undefined);
    const result = await dispatchAlert(alert, {
      webhookUrl: "https://example.invalid/webhook",
      getSecret: async () => ({ id: "key-1", actorId: "admin-1", secret: "header-secret" }),
      fetcher,
      markUsed,
    });

    expect(result).toMatchObject({ sent: true, skipped: false });
    const [, init] = fetcher.mock.calls[0];
    expect(init.headers["X-Office-Pulse-Token"]).toBe("header-secret");
    expect(JSON.parse(init.body)).not.toHaveProperty("userId");
    expect(markUsed).toHaveBeenCalledWith("key-1");
  });

  it("posts login_otp payload without url fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const markUsed = vi.fn().mockResolvedValue(undefined);
    const result = await postWebhookPayload(
      {
        type: "login_otp",
        email: "user@pwc.com",
        name: "User",
        message: "Your code is 123456",
        otp: "123456",
        otpExpiresMinutes: 10,
      },
      {
        webhookUrl: "https://example.invalid/webhook",
        getSecret: async () => ({ id: "key-1", actorId: "admin-1", secret: "header-secret" }),
        fetcher,
        markUsed,
      },
    );
    expect(result.ok).toBe(true);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.type).toBe("login_otp");
    expect(body.otp).toBe("123456");
    expect(body).not.toHaveProperty("notifyEmail");
    expect(body).not.toHaveProperty("dashboardUrl");
  });

  it("uses POWER_AUTOMATE_WEBHOOK_SECRET env without calling getSecret", async () => {
    process.env.POWER_AUTOMATE_WEBHOOK_SECRET = "env-header-secret";
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const markUsed = vi.fn().mockResolvedValue(undefined);
    const result = await dispatchAlert(alert, {
      webhookUrl: "https://example.invalid/webhook",
      fetcher,
      markUsed,
    });

    expect(result).toMatchObject({ sent: true, skipped: false });
    const [, init] = fetcher.mock.calls[0];
    expect(init.headers["X-Office-Pulse-Token"]).toBe("env-header-secret");
    expect(markUsed).not.toHaveBeenCalled();
  });
});
