import { describe, expect, it } from "vitest";
import { normalizeSsid, isOfficeSsid, parseDefaultSsidsFromEnv, DEFAULT_OFFICE_SSIDS } from "../src/lib/constants";

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

  it("rejects unknown SSIDs", () => {
    expect(isOfficeSsid("HomeWiFi", allowlist)).toBe(false);
    expect(isOfficeSsid(null, allowlist)).toBe(false);
  });
});
