import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  resolveInOfficeNow,
  visitMaintenanceGapMs,
  type InOfficeNowInput,
} from "@/lib/activity-signal";
import { isDefinitiveCheckoutSource } from "@/lib/dashboard-live-hours";

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "tests/bugs/fixtures/event-mode-inferred-checkout-in-office.json",
    ),
    "utf8",
  ),
) as {
  agentMode: string;
  agentStaleMinutes: number;
  eventModeFreshMinutes: number;
  minutesSinceOfficeHealthPing: number;
  visitEndSource: string;
  scenarios: Record<
    string,
    InOfficeNowInput & { expectedInOfficeNow: boolean }
  >;
};

describe("BUG-025 event-mode inferred checkout must not flip In office to No", () => {
  it("uses the 70-minute event-mode gap for visit maintenance, not 15 minutes", () => {
    const gapMs = visitMaintenanceGapMs(
      fixture.agentMode,
      fixture.agentStaleMinutes,
    );
    expect(gapMs).toBe(fixture.eventModeFreshMinutes * 60 * 1000);
    expect(fixture.minutesSinceOfficeHealthPing * 60 * 1000).toBeLessThan(gapMs);
    expect(visitMaintenanceGapMs("heartbeat", fixture.agentStaleMinutes)).toBe(
      fixture.agentStaleMinutes * 60 * 1000,
    );
  });

  it("treats inferred visit ends as non-definitive checkouts", () => {
    expect(isDefinitiveCheckoutSource(fixture.visitEndSource)).toBe(false);
    expect(isDefinitiveCheckoutSource("agent")).toBe(true);
    expect(isDefinitiveCheckoutSource("manual")).toBe(true);
    expect(isDefinitiveCheckoutSource("admin")).toBe(true);
  });

  it("keeps In office Yes when an inferred close follows a recent office health ping", () => {
    const { expectedInOfficeNow, ...input } =
      fixture.scenarios.inferredCloseAfterOfficePulse;
    // Today only sets checkedOutAfterPulse for agent/manual/admin ends.
    expect(isDefinitiveCheckoutSource("inferred")).toBe(false);
    expect(input.checkedOutAfterPulse).toBe(false);
    expect(resolveInOfficeNow(input)).toBe(expectedInOfficeNow);
  });

  it("still shows In office No after a real agent or manual checkout", () => {
    for (const key of [
      "agentCheckoutAfterOfficePulse",
      "manualCheckoutAfterOfficePulse",
    ] as const) {
      const { expectedInOfficeNow, ...input } = fixture.scenarios[key];
      expect(input.checkedOutAfterPulse).toBe(true);
      expect(resolveInOfficeNow(input)).toBe(expectedInOfficeNow);
    }
  });
});
