import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { daySpanMsForDay } from "@/lib/visits";
import { dayBoundsFromKey } from "@/lib/timezone-dates";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/closed-manual-not-stretched.json"),
    "utf8",
  ),
) as {
  dayKey: string;
  timezone: string;
  manualStartAt: string;
  manualEndAt: string;
  laterAgentSyncAt: string;
  now: string;
};

describe("BUG-013 closed manual visit is not stretched by later agent sync", () => {
  it("credits only the manual check-in to check-out when there is no office visit", () => {
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
      fixture.dayKey,
      fixture.timezone,
    );
    const startAt = new Date(fixture.manualStartAt);
    const endAt = new Date(fixture.manualEndAt);
    const spanMs = daySpanMsForDay(
      [
        {
          id: "manual-1",
          startAt,
          endAt,
          source: "manual",
          updatedAt: endAt,
        },
      ],
      {
        dayStart,
        dayEnd,
        now: new Date(fixture.now),
        staleMs: 15 * 60 * 1000,
        lastHeartbeatAt: new Date(fixture.laterAgentSyncAt),
        firstInOfficeHeartbeatAt: null,
        lastInOfficeHeartbeatAt: null,
      },
    );

    expect(spanMs).toBe(endAt.getTime() - startAt.getTime());
    expect(spanMs).toBe(5 * 60 * 1000);
    expect(spanMs).toBeLessThan(
      new Date(fixture.laterAgentSyncAt).getTime() - startAt.getTime(),
    );
  });
});
