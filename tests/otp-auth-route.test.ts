import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as requestOtp } from "../src/app/api/auth/otp/request/route";
import { POST as verifyOtp } from "../src/app/api/auth/otp/verify/route";

vi.mock("../src/lib/otp-auth", () => ({
  requestLoginOtp: vi.fn(),
  verifyLoginOtp: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  clearLoginAttempts: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("../src/lib/welcome-token", () => ({
  setWelcomeToken: vi.fn(),
  setInstallToken: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/breakglass", () => ({
  isBreakglassEmail: vi.fn().mockReturnValue(false),
}));

import { requestLoginOtp, verifyLoginOtp } from "../src/lib/otp-auth";
import { createSession, clearLoginAttempts } from "../src/lib/auth";
import { setWelcomeToken, setInstallToken } from "../src/lib/welcome-token";

describe("POST /api/auth/otp/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when email is missing", async () => {
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when otp request fails", async () => {
    vi.mocked(requestLoginOtp).mockResolvedValue({ ok: false, error: "Use your PwC email address" });
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: "bad@example.com" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("PwC email");
  });

  it("returns ok when otp is sent", async () => {
    vi.mocked(requestLoginOtp).mockResolvedValue({ ok: true });
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/auth/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when fields are missing", async () => {
    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates session and welcome redirect for new users", async () => {
    vi.mocked(verifyLoginOtp).mockResolvedValue({
      ok: true,
      userId: "u1",
      isNewUser: true,
      plainAgentToken: "token-abc",
    });

    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "123456" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(clearLoginAttempts).toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith("u1");
    expect(setWelcomeToken).toHaveBeenCalledWith("token-abc");
    expect(setInstallToken).toHaveBeenCalledWith("token-abc");
    const body = await res.json();
    expect(body.redirectTo).toBe("/settings?welcome=1");
  });

  it("redirects existing users to dashboard", async () => {
    vi.mocked(verifyLoginOtp).mockResolvedValue({
      ok: true,
      userId: "u1",
      isNewUser: false,
    });

    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "123456" }),
      }),
    );

    const body = await res.json();
    expect(body.redirectTo).toBe("/dashboard");
    expect(setWelcomeToken).not.toHaveBeenCalled();
  });
});
