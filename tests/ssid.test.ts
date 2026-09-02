import { describe, expect, it } from "vitest";
import { normalizeSsid, isOfficeSsid, allowlistMatchPrefix, parseDefaultSsidsFromEnv, DEFAULT_OFFICE_SSIDS } from "../src/lib/constants";

describe("parseDefaultSsidsFromEnv", () => {
  it("returns hardcoded defaults when env is unset", () => {
    expect(parseDefaultSsidsFromEnv()).toEqual(DEFAULT_OFFICE_SSIDS);
  });

  it("parses comma-separated env override", () => {
    const prev = process.env.DEFAULT_OFFICE_SSIDS;
    process.env.DEFAULT_OFFICE_SSIDS = "OfficeConnect,ExternalConnect,Airtel_Abir";
    expect(parseDefaultSsidsFromEnv()).toEqual(["OfficeConnect", "ExternalConnect", "Airtel_Abir"]);
    if (prev === undefined) delete process.env.DEFAULT_OFFICE_SSIDS;
    else process.env.DEFAULT_OFFICE_SSIDS = prev;
  });
});

describe("normalizeSsid", () => {
  it("strips Wi-Fi band suffix from profile name", () => {
    expect(normalizeSsid("OfficeConnect 11")).toBe("OfficeConnect");
    expect(isOfficeSsid("OfficeConnect 11", ["OfficeConnect", "ExternalConnect"])).toBe(true);
  });

  it("strips captive portal unauthenticated suffix", () => {
    expect(normalizeSsid("pwcglb.com 2 (Unauthenticated)")).toBe("pwcglb.com");
    expect(normalizeSsid("pwcglb.com (unauthenticated)")).toBe("pwcglb.com");
  });

  it("trims whitespace", () => {
    expect(normalizeSsid("  pwcglb.com  ")).toBe("pwcglb.com");
    expect(isOfficeSsid("  pwcglb.com  ", ["pwcglb.com"])).toBe(true);
  });
});

describe("isOfficeSsid", () => {
  const allowlist = ["OfficeConnect", "ExternalConnect", "pwcglb.com"];

  it("matches pwcglb.com exactly", () => {
    expect(isOfficeSsid("pwcglb.com", allowlist)).toBe(true);
  });

  it("matches pwcglb.com case-insensitively", () => {
    expect(isOfficeSsid("PwCGLB.com", allowlist)).toBe(true);
    expect(isOfficeSsid("PWCGLB.COM", allowlist)).toBe(true);
  });

  it("matches captive portal profile variants", () => {
    expect(isOfficeSsid("pwcglb.com 2 (Unauthenticated)", allowlist)).toBe(true);
    expect(isOfficeSsid("pwcglb.com 5 (Unauthenticated)", allowlist)).toBe(true);
  });

  it("matches ExternalConnect", () => {
    expect(isOfficeSsid("ExternalConnect", allowlist)).toBe(true);
    expect(isOfficeSsid("ExternalConnect 2", allowlist)).toBe(true);
  });

  it("rejects unknown SSIDs", () => {
    expect(isOfficeSsid("HomeWiFi", allowlist)).toBe(false);
    expect(isOfficeSsid(null, allowlist)).toBe(false);
  });

  it("supports optional trailing wildcard on allowlist entries", () => {
    expect(isOfficeSsid("pwcglb.com 2 (Unauthenticated)", ["pwcglb.com*"])).toBe(true);
    expect(isOfficeSsid("OfficeConnect 5", ["OfficeConnect*"])).toBe(true);
    expect(isOfficeSsid("HomeWiFi", ["pwcglb.com*"])).toBe(false);
  });

  it("exposes allowlist prefix without wildcard", () => {
    expect(allowlistMatchPrefix("pwcglb.com*")).toBe("pwcglb.com");
    expect(allowlistMatchPrefix("OfficeConnect")).toBe("officeconnect");
  });
});
