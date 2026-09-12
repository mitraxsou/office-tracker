import { describe, expect, it } from "vitest";
import {
  parseAgentSyncEvents,
  parseAgentSyncOpenVisit,
} from "../src/lib/agent-sync";

describe("parseAgentSyncEvents", () => {
  it("parses valid event array", () => {
    const events = parseAgentSyncEvents([
      {
        id: "evt-1",
        type: "ssid_changed",
        at: "2026-09-12T10:00:00.000Z",
        ssid: "OfficeConnect",
        previousSsid: "HomeWiFi",
      },
      { id: "evt-2", type: "visit_start", localVisitId: "lv-abc", ssid: "OfficeConnect" },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("ssid_changed");
    expect(events[1].localVisitId).toBe("lv-abc");
  });

  it("returns empty array for invalid input", () => {
    expect(parseAgentSyncEvents(null)).toEqual([]);
    expect(parseAgentSyncEvents("bad")).toEqual([]);
    expect(parseAgentSyncEvents([{ type: "missing-id" }])).toEqual([]);
  });
});

describe("parseAgentSyncOpenVisit", () => {
  it("parses open visit payload", () => {
    const open = parseAgentSyncOpenVisit({
      localVisitId: "lv-1",
      startAt: "2026-09-12T09:00:00.000Z",
      ssid: "OfficeConnect",
    });
    expect(open).toEqual({
      localVisitId: "lv-1",
      startAt: "2026-09-12T09:00:00.000Z",
      ssid: "OfficeConnect",
    });
  });

  it("returns null when required fields missing", () => {
    expect(parseAgentSyncOpenVisit({ startAt: "2026-09-12T09:00:00.000Z" })).toBeNull();
    expect(parseAgentSyncOpenVisit(null)).toBeNull();
  });
});
