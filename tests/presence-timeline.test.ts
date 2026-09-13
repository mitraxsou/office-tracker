import { describe, expect, it } from "vitest";
import {
  mergePresenceTimelineEntries,
  presenceEventLabel,
  sortPresenceTimelineEntries,
  syncTriggerLabel,
  sanitizeSyncTrigger,
  type PresenceTimelineEntry,
} from "../src/lib/presence-timeline";

const OFFICE_SSIDS = ["OfficeConnect", "ExternalConnect", "pwcglb.com"];

describe("presence timeline labels", () => {
  it("maps sync triggers to admin labels", () => {
    expect(syncTriggerLabel("resume_wake")).toBe("Sync: wake/resume");
    expect(syncTriggerLabel("ssid_change")).toBe("Sync: Wi-Fi change");
    expect(syncTriggerLabel("activity_tick")).toBe("Sync: activity tick");
  });

  it("labels office Wi-Fi transitions", () => {
    expect(
      presenceEventLabel({
        kind: "visit_start",
        ssid: "OfficeConnect",
        previousSsid: null,
        inOffice: true,
        officeSsids: OFFICE_SSIDS,
      }),
    ).toBe("Entered office (Wi-Fi)");

    expect(
      presenceEventLabel({
        kind: "ssid_changed",
        ssid: "HomeWiFi",
        previousSsid: "OfficeConnect",
        inOffice: false,
        officeSsids: OFFICE_SSIDS,
      }),
    ).toBe("Switched from office to home Wi-Fi");

    expect(
      presenceEventLabel({
        kind: "session_resume",
        ssid: "OfficeConnect",
        previousSsid: null,
        inOffice: true,
        officeSsids: OFFICE_SSIDS,
      }),
    ).toBe("Laptop woke / resumed");
  });

  it("sanitizes sync trigger values", () => {
    expect(sanitizeSyncTrigger("resume_wake")).toBe("resume_wake");
    expect(sanitizeSyncTrigger("invalid")).toBeNull();
    expect(sanitizeSyncTrigger(null)).toBeNull();
  });
});

describe("presence timeline ordering", () => {
  const sample: PresenceTimelineEntry[] = [
    {
      id: "a",
      at: "2026-09-13T10:00:00.000Z",
      kind: "activity_tick",
      label: "Activity tick",
      ssid: "HomeWiFi",
      previousSsid: null,
      inOffice: false,
      source: "activity",
    },
    {
      id: "b",
      at: "2026-09-13T12:00:00.000Z",
      kind: "ssid_changed",
      label: "Changed Wi-Fi network",
      ssid: "OfficeConnect",
      previousSsid: "HomeWiFi",
      inOffice: true,
      source: "presence",
    },
    {
      id: "c",
      at: "2026-09-13T11:00:00.000Z",
      kind: "sync_batch",
      label: "Sync: wake/resume",
      ssid: null,
      previousSsid: null,
      inOffice: null,
      syncTrigger: "resume_wake",
      source: "sync",
    },
  ];

  it("sorts entries newest first", () => {
    const sorted = sortPresenceTimelineEntries(sample);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("merges and deduplicates by id", () => {
    const merged = mergePresenceTimelineEntries(...sample, sample[0]);
    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe("b");
  });
});
