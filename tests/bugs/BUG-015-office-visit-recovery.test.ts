import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  earliestContiguousOfficeAt,
  recoveredStartFromVisitStartPayload,
  shouldBackdateWifiVisit,
} from "@/lib/office-visit-recovery";
import { dayBoundsFromKey } from "@/lib/timezone-dates";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/office-visit-recovery.json"),
    "utf8",
  ),
) as {
  dayKey: string;
  timezone: string;
  allowlist: string[];
  lateVisitStartAt: string;
  ticks: Array<{ at: string; ssid: string }>;
  expectedFirstCheckInAt: string;
};

describe("BUG-015 recover office visit start from local Wi-Fi ticks", () => {
  it("backdates a late visit_start to the first contiguous OfficeConnect tick", () => {
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
      fixture.dayKey,
      fixture.timezone,
    );
    const recovered = earliestContiguousOfficeAt({
      ticks: fixture.ticks.map((tick) => ({ at: new Date(tick.at), ssid: tick.ssid })),
      now: new Date("2026-10-06T10:10:07.000Z"),
      dayStart,
      dayEnd,
      allowlist: fixture.allowlist,
    });
    expect(recovered?.toISOString()).toBe(fixture.expectedFirstCheckInAt);
    expect(
      recoveredStartFromVisitStartPayload({
        type: "visit_start",
        at: fixture.expectedFirstCheckInAt,
        localVisitId: "lv-1",
        ssid: "OfficeConnect",
      })?.startAt.toISOString(),
    ).toBe(fixture.expectedFirstCheckInAt);
    expect(
      shouldBackdateWifiVisit({
        source: "wifi",
        currentStartAt: new Date(fixture.lateVisitStartAt),
        recoveredStartAt: recovered!,
        endAt: null,
        now: new Date("2026-10-06T10:10:07.000Z"),
      }),
    ).toBe(true);
  });
});
