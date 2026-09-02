import { describe, expect, it } from "vitest";
import { DEFAULT_HOURS_TARGET, VISIT_GAP_MS } from "../src/lib/constants";
import {
  daySpanHoursForDay,
  daySpanMsForDay,
  effectiveVisitEnd,
  mergeHeartbeatsIntoVisits,
  meetsHoursTarget,
  remainingHours,
  roundHours,
  totalHoursFromVisits,
  visitDurationMs,
  visitsForDay,
} from "../src/lib/visits";

const ms = (minutes: number) => minutes * 60 * 1000;

describe("effectiveVisitEnd", () => {
  const staleMs = VISIT_GAP_MS;
  const startAt = new Date("2026-08-28T03:00:00+05:30");
  const updatedAt = new Date("2026-08-28T03:15:00+05:30");
  const lastHeartbeatAt = new Date("2026-08-28T03:15:25+05:30");

  it("returns stored endAt when visit is closed", () => {
    const endAt = new Date("2026-08-28T04:00:00+05:30");
    expect(
      effectiveVisitEnd({
        endAt,
        updatedAt,
        startAt,
        now: new Date("2026-09-01T12:00:00+05:30"),
        staleMs,
        lastHeartbeatAt,
      }),
    ).toEqual(endAt);
  });

  it("ends open visit at last activity + gap when agent is stale", () => {
    const now = new Date("2026-09-01T12:00:00+05:30");
    const end = effectiveVisitEnd({
      endAt: null,
      updatedAt,
      startAt,
      now,
      staleMs,
      lastHeartbeatAt,
    });
    expect(end.getTime()).toBe(updatedAt.getTime() + staleMs);
  });

  it("uses now for open visit when agent is still healthy", () => {
    const now = new Date("2026-08-28T03:20:00+05:30");
    const end = effectiveVisitEnd({
      endAt: null,
      updatedAt,
      startAt,
      now,
      staleMs,
      lastHeartbeatAt,
    });
    expect(end).toEqual(now);
  });

  it("uses last heartbeat as logout when the calendar day has ended", () => {
    const dayEnd = new Date("2026-08-28T23:59:59.999+05:30");
    const now = new Date("2026-08-29T10:00:00+05:30");
    const end = effectiveVisitEnd({
      endAt: null,
      updatedAt,
      startAt,
      now,
      staleMs,
      lastHeartbeatAt,
      dayEnd,
    });
    expect(end).toEqual(lastHeartbeatAt);
  });

  it("does not extend open visit past day end when aggregating a past day", () => {
    const dayEnd = new Date("2026-08-28T23:59:59.999+05:30");
    const now = new Date("2026-09-01T12:00:00+05:30");
    const end = effectiveVisitEnd({
      endAt: null,
      updatedAt,
      startAt,
      now,
      staleMs,
      lastHeartbeatAt,
      dayEnd,
    });
    expect(end).toEqual(lastHeartbeatAt);
    expect(end.getTime()).toBeLessThanOrEqual(dayEnd.getTime());
  });
});

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
  it("calculates total hours from a single visit", () => {
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
      },
    ];
    expect(totalHoursFromVisits(visits)).toBeCloseTo(3, 1);
    expect(visitDurationMs(visits[0])).toBeCloseTo(3 * ms(60), 0);
  });

  it("uses first in to last out for daily total across gaps", () => {
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
      },
      {
        id: "2",
        startAt: new Date("2026-08-27T13:00:00+05:30"),
        endAt: new Date("2026-08-27T18:00:00+05:30"),
        source: "wifi",
      },
    ];
    expect(totalHoursFromVisits(visits)).toBeCloseTo(9, 1);
    const segmentSum =
      visitDurationMs(visits[0]) + visitDurationMs(visits[1]);
    expect(segmentSum).toBeCloseTo(8 * ms(60), 0);
  });

  it("daySpanMsForDay spans first check-in to last check-out", () => {
    const dayStart = new Date("2026-08-27T00:00:00+05:30");
    const dayEnd = new Date("2026-08-27T23:59:59.999+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-08-27T12:00:00+05:30"),
      },
      {
        id: "2",
        startAt: new Date("2026-08-27T13:00:00+05:30"),
        endAt: new Date("2026-08-27T18:00:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-08-27T18:00:00+05:30"),
      },
    ];
    const params = {
      dayStart,
      dayEnd,
      now: new Date("2026-08-27T20:00:00+05:30"),
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: new Date("2026-08-27T18:00:00+05:30"),
      lastInOfficeHeartbeatAt: new Date("2026-08-27T18:00:00+05:30"),
    };
    const spanMs = daySpanMsForDay(visits, params);
    expect(spanMs).toBeCloseTo(9 * ms(60), 0);
    expect(daySpanHoursForDay(visits, params)).toBeCloseTo(9, 1);
  });

  it("extends wifi day to last in-office heartbeat after visit ended earlier", () => {
    const dayStart = new Date("2026-08-27T00:00:00+05:30");
    const dayEnd = new Date("2026-08-27T23:59:59.999+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-08-27T12:00:00+05:30"),
      },
    ];
    const lastHb = new Date("2026-08-27T17:30:00+05:30");
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now: new Date("2026-08-27T20:00:00+05:30"),
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: lastHb,
      firstInOfficeHeartbeatAt: new Date("2026-08-27T09:00:00+05:30"),
      lastInOfficeHeartbeatAt: lastHb,
    });
    expect(spanMs).toBeCloseTo(8.5 * ms(60), 0);
  });

  it("open visit extends day past earlier closed manual visit", () => {
    const dayStart = new Date("2026-09-02T00:00:00+05:30");
    const dayEnd = new Date("2026-09-02T23:59:59.999+05:30");
    const now = new Date("2026-09-02T19:00:00+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-09-02T13:00:00+05:30"),
        endAt: new Date("2026-09-02T15:00:00+05:30"),
        source: "manual",
        updatedAt: new Date("2026-09-02T15:00:00+05:30"),
      },
      {
        id: "2",
        startAt: new Date("2026-09-02T18:22:00+05:30"),
        endAt: null,
        source: "wifi",
        updatedAt: new Date("2026-09-02T18:58:00+05:30"),
      },
    ];
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now,
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: new Date("2026-09-02T18:58:00+05:30"),
      firstInOfficeHeartbeatAt: new Date("2026-09-02T18:22:00+05:30"),
      lastInOfficeHeartbeatAt: new Date("2026-09-02T18:58:00+05:30"),
    });
    expect(spanMs).toBeCloseTo(6 * ms(60), 0);
  });

  it("open manual visit extends to now when still in office", () => {
    const dayStart = new Date("2026-09-02T00:00:00+05:30");
    const dayEnd = new Date("2026-09-02T23:59:59.999+05:30");
    const now = new Date("2026-09-02T18:00:00+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-09-02T13:00:00+05:30"),
        endAt: null,
        source: "manual",
        updatedAt: new Date("2026-09-02T13:00:00+05:30"),
      },
    ];
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now,
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: null,
    });
    expect(spanMs).toBeCloseTo(5 * ms(60), 0);
  });

  it("later in-office heartbeat extends past closed manual checkout", () => {
    const dayStart = new Date("2026-08-27T00:00:00+05:30");
    const dayEnd = new Date("2026-08-27T23:59:59.999+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T16:00:00+05:30"),
        source: "manual",
        updatedAt: new Date("2026-08-27T16:00:00+05:30"),
      },
    ];
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now: new Date("2026-08-27T20:00:00+05:30"),
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: new Date("2026-08-27T17:30:00+05:30"),
      lastInOfficeHeartbeatAt: new Date("2026-08-27T17:30:00+05:30"),
    });
    expect(spanMs).toBeCloseTo(8.5 * ms(60), 0);
  });

  it("closed manual then closed wifi spans first-in to last-out (Arnab)", () => {
    const dayStart = new Date("2026-09-02T00:00:00+05:30");
    const dayEnd = new Date("2026-09-02T23:59:59.999+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-09-02T15:02:00+05:30"),
        endAt: new Date("2026-09-02T15:34:00+05:30"),
        source: "manual",
        updatedAt: new Date("2026-09-02T15:34:00+05:30"),
      },
      {
        id: "2",
        startAt: new Date("2026-09-02T17:35:00+05:30"),
        endAt: new Date("2026-09-02T20:08:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-09-02T20:08:00+05:30"),
      },
    ];
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T21:00:00+05:30"),
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: new Date("2026-09-02T20:08:00+05:30"),
      firstInOfficeHeartbeatAt: new Date("2026-09-02T17:35:00+05:30"),
      lastInOfficeHeartbeatAt: new Date("2026-09-02T20:08:00+05:30"),
    });
    expect(spanMs).toBeCloseTo(5.1 * ms(60), 0);
    expect(daySpanHoursForDay(visits, {
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T21:00:00+05:30"),
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: new Date("2026-09-02T20:08:00+05:30"),
      firstInOfficeHeartbeatAt: new Date("2026-09-02T17:35:00+05:30"),
      lastInOfficeHeartbeatAt: new Date("2026-09-02T20:08:00+05:30"),
    })).toBeGreaterThanOrEqual(5);
  });

  it("open visit on current day extends to now when agent is healthy", () => {
    const dayStart = new Date("2026-08-27T00:00:00+05:30");
    const dayEnd = new Date("2026-08-27T23:59:59.999+05:30");
    const now = new Date("2026-08-27T15:00:00+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: null,
        source: "wifi",
        updatedAt: new Date("2026-08-27T14:58:00+05:30"),
      },
    ];
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now,
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: new Date("2026-08-27T14:58:00+05:30"),
      lastInOfficeHeartbeatAt: new Date("2026-08-27T14:58:00+05:30"),
    });
    expect(spanMs).toBeCloseTo(6 * ms(60), 0);
  });

  it("first-in last-out across lunch gap with heartbeat tail", () => {
    const dayStart = new Date("2026-08-27T00:00:00+05:30");
    const dayEnd = new Date("2026-08-27T23:59:59.999+05:30");
    const visits = [
      {
        id: "1",
        startAt: new Date("2026-08-27T09:00:00+05:30"),
        endAt: new Date("2026-08-27T12:00:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-08-27T12:00:00+05:30"),
      },
      {
        id: "2",
        startAt: new Date("2026-08-27T13:00:00+05:30"),
        endAt: new Date("2026-08-27T17:00:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-08-27T17:00:00+05:30"),
      },
    ];
    const lastHb = new Date("2026-08-27T18:00:00+05:30");
    const spanMs = daySpanMsForDay(visits, {
      dayStart,
      dayEnd,
      now: new Date("2026-08-27T20:00:00+05:30"),
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: lastHb,
      lastInOfficeHeartbeatAt: lastHb,
    });
    expect(spanMs).toBeCloseTo(9 * ms(60), 0);
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

describe("roundHours", () => {
  it("rounds to one decimal place", () => {
    expect(roundHours(1.7992508333333332)).toBe(1.8);
    expect(roundHours(4.949)).toBe(4.9);
    expect(roundHours(5)).toBe(5);
  });
});
