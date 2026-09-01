import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  extractIntegrationApiKey,
  verifyIntegrationApiKeyValue,
} from "../src/lib/integration-api-keys";

describe("extractIntegrationApiKey", () => {
  it("reads Bearer token from Authorization header", () => {
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer abcdef1234567890" },
    });
    expect(extractIntegrationApiKey(request)).toBe("abcdef1234567890");
  });

  it("reads X-Api-Key header", () => {
    const request = new Request("https://example.com", {
      headers: { "X-Api-Key": "secret-key-value-here" },
    });
    expect(extractIntegrationApiKey(request)).toBe("secret-key-value-here");
  });

  it("returns null when no auth headers", () => {
    const request = new Request("https://example.com");
    expect(extractIntegrationApiKey(request)).toBeNull();
  });
});

describe("verifyIntegrationApiKeyValue", () => {
  const originalEnv = process.env.INTEGRATION_API_KEY;

  beforeEach(() => {
    delete process.env.INTEGRATION_API_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.INTEGRATION_API_KEY;
    } else {
      process.env.INTEGRATION_API_KEY = originalEnv;
    }
  });

  it("accepts legacy env var key", async () => {
    process.env.INTEGRATION_API_KEY = "legacy-env-key-123456";
    const lookup = vi.fn();
    const ok = await verifyIntegrationApiKeyValue("legacy-env-key-123456", lookup);
    expect(ok).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects short keys", async () => {
    const ok = await verifyIntegrationApiKeyValue("short", async () => null);
    expect(ok).toBe(false);
  });

  it("rejects revoked DB keys", async () => {
    const plain = "a".repeat(32);
    const hash = await bcrypt.hash(plain, 12);
    const ok = await verifyIntegrationApiKeyValue(plain, async () => ({
      id: "k1",
      keyHash: hash,
      revokedAt: new Date(),
    }));
    expect(ok).toBe(false);
  });

  it("accepts valid non-revoked DB key", async () => {
    const plain = "b".repeat(32);
    const hash = await bcrypt.hash(plain, 12);
    const ok = await verifyIntegrationApiKeyValue(plain, async () => ({
      id: "k1",
      keyHash: hash,
      revokedAt: null,
    }));
    expect(ok).toBe(true);
  });

  it("rejects hash mismatch", async () => {
    const plain = "c".repeat(32);
    const hash = await bcrypt.hash("different-key-value-1234567890", 12);
    const ok = await verifyIntegrationApiKeyValue(plain, async () => ({
      id: "k1",
      keyHash: hash,
      revokedAt: null,
    }));
    expect(ok).toBe(false);
  });
});
