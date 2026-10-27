import { describe, expect, it } from "vitest";
import {
  countQualifyingDays,
  dayCountsAsVisited,
  dayQualifiesForTarget,
  describeMonthlyDayJourney,
} from "../src/lib/monthly-progress";

describe("presence-based monthly day counting", () => {
  it("counts sub-5h presence days toward the monthly goal without marking hours met", () => {
    const dailyHours = [2.5, 0, 5, 1.2, 0, 6];
    expect(countQualifyingDays(dailyHours, 5)).toBe(4);
    expect(dayCountsAsVisited(2.5)).toBe(true);
    expect(dayQualifiesForTarget(2.5, 5)).toBe(false);
    expect(dayQualifiesForTarget(5, 5)).toBe(true);
  });

  it("secures the journey day on presence while hours remaining stay separate", () => {
    const journey = describeMonthlyDayJourney({
      qualifyingDays: 3,
      monthlyDaysTarget: 8,
      todayMetTarget: false,
      inOfficeNow: false,
      todayHasOfficeTime: true,
    });
    expect(journey.todayAlreadyQualified).toBe(true);
    expect(journey.ongoingLabel).toBe("3rd day secured today");
  });
});
