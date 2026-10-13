import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { resolveEventModeLastHeartbeatAt } from "@/lib/activity-signal";
import { dayBoundsFromKey } from "@/lib/timezone-dates";
import { daySpanHoursForDay, effectiveVisitEnd } from "@/lib/visits";

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "tests/bugs/fixtures/event-mode-no-activity-tick-open-visit.json",
    ),
    "utf8",
  ),
) as {
  dayKey: string;
  timezone: string;
  staleMinutes: number;
  startAt: string;
  now: string;
  lastSeenAt: string;
  wifiConnectedAt: string;
};

describe("BUG-019 event-mode first signup bar without ActivityTick", () => {
  const staleMs = fixture.staleMinutes * 60 * 1000;
  const startAt = new Date(fixture.startAt);
  const now = new Date(fixture.now);
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
    fixture.dayKey,
    fixture.timezone,
  );

  it("resolves lastHeartbeatAt from lastSeenAt / wifi_connected when ticks are empty", () => {
    const lastHeartbeatAt = resolveEventModeLastHeartbeatAt({
      lastActivityAt: null,
      lastSeenAt: new Date(fixture.lastSeenAt),
      presenceRows: [{ at: new Date(fixture.wifiConnectedAt), type: "wifi_connected" }],
    });
    expect(lastHeartbeatAt).toEqual(new Date(fixture.lastSeenAt));
  });

  it("open visit with null lastHeartbeatAt spans startAt to now, not +15m", () => {
    const visits = [
      {
        id: "1",
        startAt,
        endAt: null,
        source: "wifi",
        updatedAt: startAt,
      },
    ];
    const hours = daySpanHoursForDay(visits, {
      dayStart,
      dayEnd,
      now,
      staleMs,
      lastHeartbeatAt: null,
    });
    expect(hours).toBeCloseTo(3, 2);
    expect(hours).not.toBeCloseTo(staleMs / (1000 * 60 * 60), 2);

    const end = effectiveVisitEnd({
      endAt: null,
      updatedAt: startAt,
      startAt,
      now,
      staleMs,
      lastHeartbeatAt: null,
      dayEnd,
    });
    expect(end).toEqual(now);
  });
});
