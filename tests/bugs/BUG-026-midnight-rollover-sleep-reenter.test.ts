import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { dayBoundsFromKey } from "@/lib/timezone-dates";
import {
  daySpanHoursForDay,
  filterMidnightRolloverStubVisits,
  firstOfficeInMsForDay,
  type VisitForDaySpan,
} from "@/lib/visits";

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "tests/bugs/fixtures/midnight-rollover-sleep-reenter.json",
    ),
    "utf8",
  ),
) as {
  timezone: string;
  dayKey: string;
  midnightStub: { startAt: string; endAt: string };
  afternoonReenter: { startAt: string; endAt: string };
  agentMustContain: string[];
};

describe("BUG-026 midnight NEW_DAY stub before sleep must not own Today", () => {
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
    fixture.dayKey,
    fixture.timezone,
  );
  const visits: VisitForDaySpan[] = [
    {
      id: "midnight-stub",
      startAt: new Date(fixture.midnightStub.startAt),
      endAt: new Date(fixture.midnightStub.endAt),
      source: "wifi",
      updatedAt: new Date(fixture.midnightStub.endAt),
    },
    {
      id: "afternoon",
      startAt: new Date(fixture.afternoonReenter.startAt),
      endAt: new Date(fixture.afternoonReenter.endAt),
      source: "wifi",
      updatedAt: new Date(fixture.afternoonReenter.endAt),
    },
  ];
  const reenterMs = new Date(fixture.afternoonReenter.startAt).getTime();

  it("filters the midnight stub when a later re-enter exists after a long gap", () => {
    const kept = filterMidnightRolloverStubVisits(visits, dayStart);
    expect(kept.map((v) => v.id)).toEqual(["afternoon"]);
  });

  it("sets first check-in and day span from the afternoon enter, not 12:00 am", () => {
    const params = {
      dayStart,
      dayEnd,
      now: new Date("2026-10-16T15:33:00+05:30"),
      staleMs: 15 * 60 * 1000,
      lastHeartbeatAt: new Date(fixture.afternoonReenter.endAt),
      firstInOfficeHeartbeatAt: new Date(fixture.midnightStub.startAt),
      lastInOfficeHeartbeatAt: new Date(fixture.afternoonReenter.endAt),
    };
    expect(firstOfficeInMsForDay(visits, params)).toBe(reenterMs);
    expect(daySpanHoursForDay(visits, params)).toBeLessThan(1);
    expect(daySpanHoursForDay(visits, params)).toBeGreaterThan(0);
  });

  it("agent defers NEW_DAY visit_start until resume or Wi-Fi enter", () => {
    const heartbeat = readFileSync(
      path.join(process.cwd(), "agent/office-heartbeat.ps1"),
      "utf8",
    );
    for (const needle of fixture.agentMustContain) {
      expect(heartbeat).toContain(needle);
    }
    expect(heartbeat).not.toContain("NEW_DAY visit_start on office Wi-Fi");
  });
});
