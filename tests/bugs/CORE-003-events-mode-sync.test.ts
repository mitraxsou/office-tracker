import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseAgentSyncEvents } from "@/lib/agent-sync";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/core-events-mode.json"), "utf8"),
) as {
  agentMode: string;
  sampleEvents: unknown[];
};

describe("CORE-003 events-mode sync", () => {
  it("fixture uses events mode with visit lifecycle events", () => {
    expect(fixture.agentMode).toBe("events");
    const parsed = parseAgentSyncEvents(fixture.sampleEvents);
    expect(parsed.map((e) => e.type)).toEqual(["visit_start", "activity_tick", "visit_end"]);
  });

  it("indexes full sync coverage without duplicating the large suite", () => {
    expect(
      readFileSync(path.join(process.cwd(), "tests/agent-sync.test.ts"), "utf8"),
    ).toContain("processAgentSync");
    expect(
      readFileSync(path.join(process.cwd(), "tests/bugs/catalog.json"), "utf8"),
    ).toContain("tests/agent-sync.test.ts");
  });
});
