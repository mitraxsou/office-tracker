import { describe, expect, it } from "vitest";
import { heartbeatInOffice } from "../src/lib/heartbeat-office";

describe("heartbeatInOffice", () => {
  const allowlist = ["OfficeConnect", "ExternalConnect", "pwcglb.com"];

  it("re-evaluates from SSID when allowlist grows", () => {
    expect(
      heartbeatInOffice(
        { ssid: "pwcglb.com 2 (Unauthenticated)", inOffice: false },
        allowlist,
      ),
    ).toBe(true);
  });

  it("uses stored flag when SSID is missing", () => {
    expect(heartbeatInOffice({ ssid: null, inOffice: true }, allowlist)).toBe(true);
    expect(heartbeatInOffice({ ssid: null, inOffice: false }, allowlist)).toBe(false);
  });

  it("rejects non-office SSID even if stored inOffice was true", () => {
    expect(heartbeatInOffice({ ssid: "Prajwal's iPhone", inOffice: true }, allowlist)).toBe(
      false,
    );
  });
});
