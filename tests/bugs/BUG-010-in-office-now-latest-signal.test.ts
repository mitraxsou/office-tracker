import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { resolveInOfficeNow, type InOfficeNowInput } from "@/lib/activity-signal";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/in-office-now-latest-signal.json"),
    "utf8",
  ),
) as Record<string, InOfficeNowInput & { expected: boolean }>;

describe("BUG-010 in office now follows the latest signal", () => {
  it("drops a stuck open visit when a newer snapshot is out of the office", () => {
    const { expected, ...input } = fixture.stuckOpenVisitAfterHomeSnapshot;
    expect(resolveInOfficeNow(input)).toBe(expected);
  });

  it("includes a user with a recent in-office snapshot and no open visit", () => {
    const { expected, ...input } = fixture.inOfficeHealthSnapshotWithoutVisit;
    expect(resolveInOfficeNow(input)).toBe(expected);
  });

  it("includes a user who arrived after an earlier out-of-office snapshot", () => {
    const { expected, ...input } = fixture.arrivedAfterEarlierHomeSnapshot;
    expect(resolveInOfficeNow(input)).toBe(expected);
  });

  it("excludes a user who checked out after the last in-office snapshot", () => {
    const { expected, ...input } = fixture.checkedOutAfterLastOfficeSnapshot;
    expect(resolveInOfficeNow(input)).toBe(expected);
  });
});
