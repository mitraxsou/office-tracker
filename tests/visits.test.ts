import { describe, expect, it } from "vitest";
import { DEFAULT_HOURS_TARGET, VISIT_GAP_MS } from "../src/lib/constants";
import {
  mergeHeartbeatsIntoVisits,
  meetsHoursTarget,
  remainingHours,
  totalHoursFromVisits,
  visitsForDay,
} from "../src/lib/visits";

const ms = (minutes: number) => minutes * 60 * 1000;

describe("mergeHeartbeatsIntoVisits", () => {
  it("merges consecutive in-office heartbeats within gap", () => {
    const base = new Date("2026-08-27T09:00:00+05:30");
    const heartbeats = [
      { recordedAt: new Date(base.getTime()), inOffice: true },
      { recordedAt: new Date(base.getTime() + ms(2)), inOffice: true },
      { recordedAt: new Date(base.getTime() + ms(4)), inOffice: true },
    ];
    const visits = mergeHeartbeatsIntoVisits(heartbeats);
    expect(visits).toHaveLength(1);
    expect(visits[0].startAt).toEqual(heartbeats[0].recordedAt);
    expect(visits[0].endAt).toEqual(heartbeats[2].recordedAt);
  });

  it("splits visits when gap exceeds 8 minutes", () => {
    const base = new Date("2026-08-27T09:00:00+05:30");
    const heartbeats = [
      { recordedAt: new Date(base.getTime()), inOffice: true },
      { recordedAt: new Date(base.getTime() + ms(2)), inOffice: true },
      { recordedAt: new Date(base.getTime() + ms(12)), inOffice: true },
    ];
    const visits = mergeHeartbeatsIntoVisits(heartbeats, VISIT_GAP_MS);
    expect(visits).toHaveLength(2);
  });

  it("ignores out-of-office heartbeats", () => {
    const base = new Date("2026-08-27T09:00:00+05:30");
    const heartbeats = [
      { recordedAt: new Date(base.getTime()), inOffice: true },
      { recordedAt: new Date(base.getTime() + ms(2)), inOffice: false },
      { recordedAt: new Date(base.getTime() + ms(4)), inOffice: true },
    ];
    const visits = mergeHeartbeatsIntoVisits(heartbeats);
    expect(visits).toHaveLength(2);
  });
});

describe("hours calculations", () => {
  it("calculates total hours from visits", () => {
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
      },
    ];
    expect(totalHoursFromVisits(visits)).toBeCloseTo(3, 1);
  });

  it("detects 5h target met", () => {
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T14:30:00+05:30"),
        source: "wifi",
      },
    ];
    expect(meetsHoursTarget(visits, DEFAULT_HOURS_TARGET)).toBe(true);
    expect(remainingHours(visits, DEFAULT_HOURS_TARGET)).toBe(0);
  });

  it("detects 5h target not met", () => {
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
      },
    ];
    expect(meetsHoursTarget(visits, DEFAULT_HOURS_TARGET)).toBe(false);
    expect(remainingHours(visits, DEFAULT_HOURS_TARGET)).toBeCloseTo(2, 0);
  });
});

describe("visitsForDay Asia/Kolkata", () => {
  it("clips visits to the requested day", () => {
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-26T22:00:00+05:30"),
        endAt: new Date("2026-08-27T01:00:00+05:30"),
        source: "wifi",
      },
    ];
    const dayVisits = visitsForDay(
      visits,
      new Date("2026-08-27T10:00:00+05:30"),
      "Asia/Kolkata"
    );
    expect(dayVisits).toHaveLength(1);
    expect(dayVisits[0].startAt.getTime()).toBeLessThanOrEqual(
      new Date("2026-08-27T01:00:00+05:30").getTime()
    );
  });
});
