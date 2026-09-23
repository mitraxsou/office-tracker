import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { selectHeartbeatAlertTypes } from "@/lib/heartbeat-alerts";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/hours-started-after-sync.json"),
    "utf8",
  ),
) as {
  heartbeat: {
    inOffice: boolean;
    oooCleared: boolean;
    metTarget: boolean;
    hoursStartedSent: boolean;
    hoursMetSent: boolean;
    monthlySnapshotSent: boolean;
  };
  expectedTypes: string[];
};

describe("BUG-005 hours_started after visit already exists", () => {
  it("still queues hours_started when in-office and not yet dispatched", () => {
    expect(selectHeartbeatAlertTypes(fixture.heartbeat)).toEqual(fixture.expectedTypes);
  });

  it("does not require absence of a visit (source comment documents the trap)", () => {
    const src = readFileSync(path.join(process.cwd(), "src/lib/heartbeat-alerts.ts"), "utf8");
    expect(src).toContain("Sync writes the visit before alerts are evaluated");
    expect(src).toContain("if (input.inOffice && !input.hoursStartedSent)");
  });
});
