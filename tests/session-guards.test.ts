import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { enforcePasswordChangeIfRequired } from "../src/lib/session-guards";

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
