import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_HOURS_TARGET } from "@/lib/constants";
import { dayQualifiesForTarget } from "@/lib/monthly-progress";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/core-hours-target.json"), "utf8"),
) as {
  defaultHoursTarget: number;
  qualifyingHours: number;
  belowTargetHours: number;
};

describe("CORE-002 five-hour daily target", () => {
  it("defaults the pilot target to 5 hours", () => {
    expect(DEFAULT_HOURS_TARGET).toBe(5);
    expect(fixture.defaultHoursTarget).toBe(DEFAULT_HOURS_TARGET);
  });

  it("qualifies a day only at or above the target duration", () => {
    expect(dayQualifiesForTarget(fixture.qualifyingHours, fixture.defaultHoursTarget)).toBe(true);
    expect(dayQualifiesForTarget(fixture.belowTargetHours, fixture.defaultHoursTarget)).toBe(
      false,
    );
  });
});
