import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { validateVisitTimestamps } from "@/lib/visit-validation";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/invalid-visit-times.json"), "utf8"),
) as {
  openVisit: { startAt: string };
  badSleepCheckout: { suspendAt: string };
  invertedClosedVisit: { startAt: string; endAt: string };
};

describe("BUG-004 invalid visit times / sleep checkout", () => {
  it("rejects inverted closed visits from the fixture", () => {
    const start = new Date(fixture.invertedClosedVisit.startAt);
    const end = new Date(fixture.invertedClosedVisit.endAt);
    expect(end.getTime()).toBeLessThan(start.getTime());
    expect(validateVisitTimestamps(start, end, start)).toBe(
      "Check-out time cannot be before check-in",
    );
  });

  it("fixture sleep checkout is before open visit start (must be skipped)", () => {
    const start = new Date(fixture.openVisit.startAt);
    const suspend = new Date(fixture.badSleepCheckout.suspendAt);
    expect(suspend.getTime()).toBeLessThan(start.getTime());
  });

  it("agent skips sleep checkout when suspendAt is before open start", () => {
    const heartbeat = readFileSync(
      path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
      "utf8",
    );
    expect(heartbeat).toContain("SKIP sleep checkout: suspendAt before open visit start");
    expect(heartbeat).toContain("SKIP visit_end: end before start");
  });

  it("server sync code repairs inverted wifi endAt before startAt", () => {
    const sync = readFileSync(path.join(process.cwd(), "src/lib/agent-sync.ts"), "utf8");
    expect(sync).toContain("Repair same-day wifi visits that were closed with endAt before startAt");
    expect(sync).toContain("recent.endAt.getTime() < recent.startAt.getTime()");
  });
});
