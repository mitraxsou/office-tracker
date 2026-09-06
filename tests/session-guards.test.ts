import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("../src/lib/legal-config", () => ({
  getCurrentLegalVersion: vi.fn().mockResolvedValue(2),
}));

import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "../src/lib/session-guards";

describe("enforcePasswordChangeIfRequired", () => {
  const originalBreakglassEmail = process.env.BREAKGLASS_EMAIL;

  beforeEach(() => {
    redirectMock.mockClear();
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
  });

  afterEach(() => {
    process.env.BREAKGLASS_EMAIL = originalBreakglassEmail;
  });

  it("redirects regular users who must change password", () => {
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    expect(() =>
      enforcePasswordChangeIfRequired({
        mustChangePassword: true,
        email: "user@pwc.office",
      }),
    ).toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/settings?mustChange=1");
  });

  it("skips redirect for breakglass even when mustChangePassword is true", () => {
    enforcePasswordChangeIfRequired({
      mustChangePassword: true,
      email: "breakglass@pwc.office",
    });

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not redirect when mustChangePassword is false", () => {
    enforcePasswordChangeIfRequired({
      mustChangePassword: false,
      email: "user@pwc.office",
    });

    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("enforceTermsAcceptanceIfRequired", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects users who have not accepted current version", async () => {
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      enforceTermsAcceptanceIfRequired(
        {
          mustChangePassword: false,
          email: "user@pwc.office",
          termsAcceptedVersion: 1,
        },
        "/dashboard",
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/terms/accept?next=%2Fdashboard");
  });

  it("skips redirect when password change is required first", async () => {
    await enforceTermsAcceptanceIfRequired(
      {
        mustChangePassword: true,
        email: "user@pwc.office",
        termsAcceptedVersion: null,
      },
      "/dashboard",
    );

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("skips redirect when user accepted current version", async () => {
    await enforceTermsAcceptanceIfRequired(
      {
        mustChangePassword: false,
        email: "user@pwc.office",
        termsAcceptedVersion: 2,
      },
      "/dashboard",
    );

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
