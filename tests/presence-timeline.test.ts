import { describe, expect, it } from "vitest";
import {
  mergePresenceTimelineEntries,
  pickLastWifiBeforeGap,
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
    expect(syncTriggerLabel("health_ping")).toBe("Sync: health ping");
    expect(syncTriggerLabel("end_of_day")).toBe("Sync: end-of-day diagnostics");
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

    expect(
      presenceEventLabel({
        kind: "session_suspend",
        ssid: "pwcglb.com",
        previousSsid: null,
        inOffice: true,
        officeSsids: OFFICE_SSIDS,
      }),
    ).toBe("Laptop slept on office Wi-Fi");
  });

  it("prefers pre-sleep office SSID for gap Wi-Fi label", () => {
    const gapMs = 44.3 * 60 * 1000;
    const beforeMs = Date.parse("2026-09-17T16:24:53.000Z");
    const picked = pickLastWifiBeforeGap({
      gapMs,
      beforeMs,
      lastSsidFromAgent: "pwcglb.com",
      lastActivity: {
        atMs: Date.parse("2026-09-17T15:36:00.000Z"),
        ssid: "Ashutosh",
      },
    });
    expect(picked).toBe("pwcglb.com");
  });

  it("uses last activity tick when it falls before the gap window edge", () => {
    const gapMs = 44 * 60 * 1000;
    const beforeMs = Date.parse("2026-09-17T16:24:53.000Z");
    const picked = pickLastWifiBeforeGap({
      gapMs,
      beforeMs,
      suspend: {
        atMs: Date.parse("2026-09-17T15:40:53.000Z"),
        ssid: "pwcglb.com",
      },
    });
    expect(picked).toBe("pwcglb.com");
  });

  it("sanitizes sync trigger values", () => {
    expect(sanitizeSyncTrigger("resume_wake")).toBe("resume_wake");
    expect(sanitizeSyncTrigger("invalid")).toBeNull();
    expect(sanitizeSyncTrigger(null)).toBeNull();
  });
});

describe("presence timeline dedupe", () => {
  it("drops duplicate rows with same source, kind, and second", () => {
    const merged = mergePresenceTimelineEntries(
      {
        id: "presence-1",
        at: "2026-09-17T07:02:09.000Z",
        kind: "session_resume",
        label: "Laptop woke / resumed",
        ssid: "Abir_EXT",
        previousSsid: null,
        inOffice: false,
        source: "presence",
      },
      {
        id: "presence-2",
        at: "2026-09-17T07:02:09.100Z",
        kind: "session_resume",
        label: "Laptop woke / resumed",
        ssid: "Abir_EXT",
        previousSsid: null,
        inOffice: false,
        source: "presence",
      },
    );
    expect(merged).toHaveLength(1);
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
