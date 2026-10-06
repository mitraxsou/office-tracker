import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { mergeRequiredOfficeSsids } from "@/lib/constants";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/officeconnect-allowlist-merge.json"),
    "utf8",
  ),
) as { storedSsids: string[]; expectedSsids: string[] };

describe("BUG-014 OfficeConnect stays on the office allowlist", () => {
  it("restores OfficeConnect when an older save omitted it", () => {
    expect(mergeRequiredOfficeSsids(fixture.storedSsids)).toEqual(fixture.expectedSsids);
  });
});
