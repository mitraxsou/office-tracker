import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  regenerateUserAgentToken: vi.fn(),
  getUserInstallTokenState: vi.fn(),
  logAuditEvent: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
  regenerateUserAgentToken: mocks.regenerateUserAgentToken,
  getUserInstallTokenState: mocks.getUserInstallTokenState,
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/security", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST } from "../src/app/api/settings/agent-token/regenerate/route";

describe("POST /api/settings/agent-token/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    process.env.NEXT_PUBLIC_APP_URL = "https://office.example";
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    mocks.regenerateUserAgentToken.mockResolvedValue({
      plainToken: "a".repeat(64),
      record: { id: "tok-new", label: "Laptop 1", userId: "user-1" },
    });
    mocks.getUserInstallTokenState.mockResolvedValue({
      installTokens: [],
      legacyBoundCount: 0,
    });
  });

  it("returns 401 when not signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/settings/agent-token/regenerate", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockReturnValue(false);
    const res = await POST(new Request("http://localhost/api/settings/agent-token/regenerate", { method: "POST" }));
    expect(res.status).toBe(429);
  });

  it("revokes and issues a token for the signed-in user", async () => {
    const res = await POST(
      new Request("http://localhost/api/settings/agent-token/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: "tok-old" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.regenerateUserAgentToken).toHaveBeenCalledWith("user-1", "tok-old");
    const body = await res.json();
    expect(body.token).toBe("a".repeat(64));
    expect(body.setupCommand).toContain("a".repeat(64));
    expect(body.installCommand).toContain("a".repeat(64));
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent_token_reissue",
        details: expect.objectContaining({ reason: "self_regenerate", selfService: true }),
      }),
    );
  });

  it("returns 404 when token is not owned", async () => {
    mocks.regenerateUserAgentToken.mockRejectedValue(new Error("Token not found"));
    const res = await POST(
      new Request("http://localhost/api/settings/agent-token/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: "missing" }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
