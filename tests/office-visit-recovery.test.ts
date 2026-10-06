import { describe, expect, it } from "vitest";
import {
  contiguousOfficeSegment,
  earliestContiguousOfficeAt,
  shouldBackdateWifiVisit,
  shouldCreateRecoveredWifiVisit,
} from "../src/lib/office-visit-recovery";

const allowlist = ["OfficeConnect", "ExternalConnect", "pwcglb.com"];
const dayStart = new Date("2026-10-06T00:00:00+05:30");
const dayEnd = new Date("2026-10-06T23:59:59.999+05:30");
const now = new Date("2026-10-06T15:40:00+05:30");

describe("contiguous office tick recovery", () => {
  it("uses the earliest OfficeConnect tick in a 2-minute pulse chain", () => {
    const ticks = [
      { at: new Date("2026-10-06T09:10:00.000Z"), ssid: "Abir_EXT" },
      { at: new Date("2026-10-06T09:19:36.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:30:12.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:42:00.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:54:00.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T10:06:00.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T10:10:07.000Z"), ssid: "OfficeConnect" },
    ];
    expect(
      earliestContiguousOfficeAt({ ticks, now, dayStart, dayEnd, allowlist })?.toISOString(),
    ).toBe("2026-10-06T09:19:36.000Z");
  });

  it("stops at a missing SSID or home network", () => {
    const ticks = [
      { at: new Date("2026-10-06T09:00:00.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:02:00.000Z"), ssid: null },
      { at: new Date("2026-10-06T09:04:00.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:06:00.000Z"), ssid: "OfficeConnect" },
    ];
    const segment = contiguousOfficeSegment({ ticks, now, dayStart, dayEnd, allowlist });
    expect(segment?.start.toISOString()).toBe("2026-10-06T09:04:00.000Z");
  });

  it("splits segments across a gap larger than 15 minutes", () => {
    const ticks = [
      { at: new Date("2026-10-06T08:00:00.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:19:36.000Z"), ssid: "OfficeConnect" },
      { at: new Date("2026-10-06T09:22:00.000Z"), ssid: "OfficeConnect" },
    ];
    expect(
      earliestContiguousOfficeAt({ ticks, now, dayStart, dayEnd, allowlist })?.toISOString(),
    ).toBe("2026-10-06T09:19:36.000Z");
  });

  it("does not credit home Wi-Fi", () => {
    const ticks = [{ at: new Date("2026-10-06T09:19:36.000Z"), ssid: "Abir_EXT" }];
    expect(earliestContiguousOfficeAt({ ticks, now, dayStart, dayEnd, allowlist })).toBeNull();
  });
});

describe("wifi visit backdate guards", () => {
  it("backdates an open wifi visit to an earlier recovered start", () => {
    expect(
      shouldBackdateWifiVisit({
        source: "wifi",
        currentStartAt: new Date("2026-10-06T10:10:07.000Z"),
        recoveredStartAt: new Date("2026-10-06T09:19:36.000Z"),
        endAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("never changes a closed manual visit", () => {
    expect(
      shouldBackdateWifiVisit({
        source: "manual",
        currentStartAt: new Date("2026-10-06T09:12:00.000Z"),
        recoveredStartAt: new Date("2026-10-06T08:00:00.000Z"),
        endAt: new Date("2026-10-06T09:17:00.000Z"),
        now,
      }),
    ).toBe(false);
  });

  it("creates an open recovered visit while still in office", () => {
    expect(
      shouldCreateRecoveredWifiVisit({
        existing: null,
        recoveredStartAt: new Date("2026-10-06T09:19:36.000Z"),
        recoveredEndAt: new Date("2026-10-06T10:10:07.000Z"),
        stillInOffice: true,
      }),
    ).toBe(true);
  });
});
