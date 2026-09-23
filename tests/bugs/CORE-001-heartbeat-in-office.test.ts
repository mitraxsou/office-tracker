import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { heartbeatInOffice } from "@/lib/heartbeat-office";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/core-ssid-allowlist.json"), "utf8"),
) as {
  allowlist: string[];
  inOfficeSamples: Array<{ ssid: string; expected: boolean }>;
  outOfOfficeSamples: Array<{ ssid: string | null; inOfficeFlag?: boolean; expected: boolean }>;
};

describe("CORE-001 heartbeat in-office SSID allowlist", () => {
  it("counts office SSIDs from the fixture allowlist", () => {
    for (const sample of fixture.inOfficeSamples) {
      expect(
        heartbeatInOffice({ ssid: sample.ssid, inOffice: false }, fixture.allowlist),
      ).toBe(sample.expected);
    }
  });

  it("rejects non-office SSIDs even if a stale inOffice flag is true", () => {
    for (const sample of fixture.outOfOfficeSamples) {
      expect(
        heartbeatInOffice(
          { ssid: sample.ssid, inOffice: sample.inOfficeFlag ?? false },
          fixture.allowlist,
        ),
      ).toBe(sample.expected);
    }
  });
});
