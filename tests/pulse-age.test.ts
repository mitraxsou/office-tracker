import { describe, expect, it } from "vitest";
import { formatPulseAge } from "@/lib/pulse-age";

describe("formatPulseAge", () => {
  const now = new Date("2026-09-03T12:00:00+05:30");

  it("formats short pulse ages clearly", () => {
    expect(formatPulseAge({ minutes: 0, now })).toBe("just now");
    expect(formatPulseAge({ minutes: 15, now })).toBe("15m");
    expect(formatPulseAge({ minutes: 135, now })).toBe("2h 15m");
  });

  it("formats day and hour durations", () => {
    expect(formatPulseAge({ minutes: 27 * 60, now })).toBe("1d 3h");
  });

  it("adds the local last time when the pulse is on an earlier calendar day", () => {
    expect(
      formatPulseAge({
        minutes: 49 * 60,
        lastPulseAt: new Date("2026-09-01T11:00:00+05:30"),
        timezone: "Asia/Kolkata",
        now,
      }),
    ).toMatch(/^2d 1h · last 1 Sept, 11:00 am$/i);
  });

  it("does not add a date for a pulse from the same local day", () => {
    expect(
      formatPulseAge({
        minutes: 15,
        lastPulseAt: new Date("2026-09-03T11:45:00+05:30"),
        timezone: "Asia/Kolkata",
        now,
      }),
    ).toBe("15m");
  });
});
