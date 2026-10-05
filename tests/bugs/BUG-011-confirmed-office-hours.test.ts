import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  latestConfirmedOfficeAt,
  mergeConfirmedOfficeInstants,
  presenceSignalInOffice,
} from "@/lib/activity-signal";
import { daySpanMsForDay } from "@/lib/visits";
import { dayBoundsFromKey } from "@/lib/timezone-dates";

type Signal = { at: string; ssid: string; storedInOffice: boolean };

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/confirmed-office-through-snapshot.json"),
    "utf8",
  ),
) as {
  officeSsids: string[];
  enteredAt: string;
  confirmedAt: string;
  pageOpenedAt: string;
  olderOfficeAt: string;
  signals: Signal[];
};

describe("BUG-011 confirmed office time follows the latest allowlisted snapshot", () => {
  const officeSignals = fixture.signals.filter((signal) =>
    presenceSignalInOffice({
      ssid: signal.ssid,
      storedInOffice: signal.storedInOffice,
      officeSsids: fixture.officeSsids,
    }),
  );

  it("ignores personal network names even when the stored flag says in office", () => {
    const names = officeSignals.map((signal) => signal.ssid);
    expect(names).not.toContain("Ashutosh");
    expect(names).not.toContain("Airtel_samir_2000");
    expect(names).not.toContain("Who are you?");
    expect(names).toContain("pwcglb.com");
  });

  it("uses today's office snapshot as the last office activity", () => {
    const latest = latestConfirmedOfficeAt(
      fixture.signals.map((signal) => ({
        at: new Date(signal.at),
        ssid: signal.ssid,
        storedInOffice: signal.storedInOffice,
      })),
      fixture.officeSsids,
    );
    expect(latest?.toISOString()).toBe(fixture.confirmedAt);
    expect(latest?.toISOString()).not.toBe(fixture.olderOfficeAt);
  });

  it("counts a closed visit through the later office snapshot and not the page clock", () => {
    const entered = new Date(fixture.enteredAt);
    const confirmed = new Date(fixture.confirmedAt);
    const bounds = mergeConfirmedOfficeInstants(
      officeSignals
        .filter((signal) => signal.at.startsWith("2026-10-05"))
        .map((signal) => new Date(signal.at)),
    );
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-05", "Asia/Kolkata");
    const spanMs = daySpanMsForDay(
      [
        {
          id: "visit-1",
          startAt: entered,
          endAt: entered,
          source: "wifi",
          updatedAt: entered,
        },
      ],
      {
        dayStart,
        dayEnd,
        now: new Date(fixture.pageOpenedAt),
        staleMs: 15 * 60 * 1000,
        lastHeartbeatAt: confirmed,
        firstInOfficeHeartbeatAt: bounds.first,
        lastInOfficeHeartbeatAt: bounds.last,
      },
    );
    expect(spanMs).toBe(confirmed.getTime() - entered.getTime());
    expect(spanMs).toBeLessThan(new Date(fixture.pageOpenedAt).getTime() - entered.getTime());
  });

  it("stops at a later leave and ignores the non-office snapshot after it", () => {
    const entered = new Date(fixture.enteredAt);
    const confirmed = new Date(fixture.confirmedAt);
    const left = new Date(confirmed.getTime() + 20 * 60 * 1000);
    const homeAfter = new Date(left.getTime() + 30 * 60 * 1000);
    const latest = latestConfirmedOfficeAt(
      [
        ...fixture.signals,
        { at: homeAfter.toISOString(), ssid: "Ashutosh", storedInOffice: false },
      ].map((signal) => ({
        at: new Date(signal.at),
        ssid: signal.ssid,
        storedInOffice: signal.storedInOffice,
      })),
      fixture.officeSsids,
    );
    expect(latest?.toISOString()).toBe(fixture.confirmedAt);
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-05", "Asia/Kolkata");
    const spanMs = daySpanMsForDay(
      [
        {
          id: "visit-1",
          startAt: entered,
          endAt: left,
          source: "wifi",
          updatedAt: left,
        },
      ],
      {
        dayStart,
        dayEnd,
        now: new Date(fixture.pageOpenedAt),
        staleMs: 15 * 60 * 1000,
        lastHeartbeatAt: confirmed,
        firstInOfficeHeartbeatAt: entered,
        lastInOfficeHeartbeatAt: latest,
      },
    );
    expect(spanMs).toBe(left.getTime() - entered.getTime());
    expect(spanMs).toBeLessThan(new Date(fixture.pageOpenedAt).getTime() - entered.getTime());
  });

  it("does not recalculate a past day against the current clock", () => {
    const entered = new Date(fixture.enteredAt);
    const confirmed = new Date(fixture.confirmedAt);
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-05", "Asia/Kolkata");
    const spanMs = daySpanMsForDay(
      [
        {
          id: "visit-1",
          startAt: entered,
          endAt: confirmed,
          source: "wifi",
          updatedAt: confirmed,
        },
      ],
      {
        dayStart,
        dayEnd,
        now: new Date("2026-10-06T12:00:00+05:30"),
        staleMs: 15 * 60 * 1000,
        lastHeartbeatAt: confirmed,
        firstInOfficeHeartbeatAt: entered,
        lastInOfficeHeartbeatAt: confirmed,
      },
    );
    expect(spanMs).toBe(confirmed.getTime() - entered.getTime());
  });

  it("keeps an open manual visit running until checkout", () => {
    const start = new Date(fixture.enteredAt);
    const now = new Date(fixture.pageOpenedAt);
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-05", "Asia/Kolkata");
    const spanMs = daySpanMsForDay(
      [
        {
          id: "visit-manual",
          startAt: start,
          endAt: null,
          source: "manual",
          updatedAt: start,
        },
      ],
      {
        dayStart,
        dayEnd,
        now,
        staleMs: 15 * 60 * 1000,
        lastHeartbeatAt: new Date(fixture.confirmedAt),
        firstInOfficeHeartbeatAt: start,
        lastInOfficeHeartbeatAt: new Date(fixture.confirmedAt),
      },
    );
    expect(spanMs).toBe(now.getTime() - start.getTime());
  });
});
