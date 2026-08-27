import { describe, expect, it } from "vitest";
import { normalizeSsid, isOfficeSsid } from "../src/lib/constants";

describe("normalizeSsid", () => {
  it("strips Wi-Fi band suffix from profile name", () => {
    expect(normalizeSsid("OfficeConnect 11")).toBe("OfficeConnect");
    expect(isOfficeSsid("OfficeConnect 11", ["OfficeConnect", "ExternalConnect"])).toBe(true);
  });
});
