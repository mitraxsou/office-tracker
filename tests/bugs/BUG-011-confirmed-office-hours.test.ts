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
});
