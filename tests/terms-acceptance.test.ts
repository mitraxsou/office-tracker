import { describe, expect, it } from "vitest";
import {
  getPostLoginRedirect,
  sanitizeTermsAcceptNextPath,
  userNeedsTermsAcceptance,
} from "../src/lib/terms-acceptance";

const CURRENT_VERSION = 2;

describe("userNeedsTermsAcceptance", () => {
  it("returns true when termsAcceptedVersion is null", () => {
    expect(userNeedsTermsAcceptance({ termsAcceptedVersion: null }, CURRENT_VERSION)).toBe(true);
  });

  it("returns true when accepted version is behind current", () => {
    expect(userNeedsTermsAcceptance({ termsAcceptedVersion: 1 }, CURRENT_VERSION)).toBe(true);
  });

  it("returns false when accepted version matches current", () => {
    expect(userNeedsTermsAcceptance({ termsAcceptedVersion: 2 }, CURRENT_VERSION)).toBe(false);
  });
});

describe("getPostLoginRedirect", () => {
  const baseUser = {
    email: "user@pwc.com",
    mustChangePassword: false,
    termsAcceptedAt: null as Date | null,
    termsAcceptedVersion: null as number | null,
  };

  it("prioritizes password change for non-breakglass users", () => {
    expect(
      getPostLoginRedirect(
        {
          ...baseUser,
          mustChangePassword: true,
        },
        CURRENT_VERSION,
      ),
    ).toBe("/settings?mustChange=1");
  });

  it("sends new users without terms to accept with welcome next path", () => {
    expect(getPostLoginRedirect(baseUser, CURRENT_VERSION, { isNewUser: true })).toBe(
      "/terms/accept?next=%2Fsettings%3Fwelcome%3D1",
    );
  });

  it("sends existing users without terms to accept with dashboard next path", () => {
    expect(getPostLoginRedirect(baseUser, CURRENT_VERSION)).toBe(
      "/terms/accept?next=%2Fdashboard",
    );
  });

  it("sends users on stale version to accept again", () => {
    expect(
      getPostLoginRedirect(
        { ...baseUser, termsAcceptedVersion: 1, termsAcceptedAt: new Date("2026-09-01") },
        CURRENT_VERSION,
      ),
    ).toBe("/terms/accept?next=%2Fdashboard");
  });

  it("sends new users with current terms to welcome settings", () => {
    expect(
      getPostLoginRedirect(
        { ...baseUser, termsAcceptedVersion: 2, termsAcceptedAt: new Date("2026-09-01") },
        CURRENT_VERSION,
        { isNewUser: true },
      ),
    ).toBe("/settings?welcome=1");
  });

  it("sends existing users with current terms to dashboard", () => {
    expect(
      getPostLoginRedirect(
        { ...baseUser, termsAcceptedVersion: 2, termsAcceptedAt: new Date("2026-09-01") },
        CURRENT_VERSION,
      ),
    ).toBe("/dashboard");
  });
});

describe("sanitizeTermsAcceptNextPath", () => {
  it("defaults invalid paths to dashboard", () => {
    expect(sanitizeTermsAcceptNextPath(undefined)).toBe("/dashboard");
    expect(sanitizeTermsAcceptNextPath("https://evil.example")).toBe("/dashboard");
    expect(sanitizeTermsAcceptNextPath("//evil.example")).toBe("/dashboard");
  });

  it("blocks redirect loops through terms accept", () => {
    expect(sanitizeTermsAcceptNextPath("/terms/accept?next=/dashboard")).toBe("/dashboard");
  });

  it("keeps valid internal paths", () => {
    expect(sanitizeTermsAcceptNextPath("/settings?welcome=1")).toBe("/settings?welcome=1");
  });
});
