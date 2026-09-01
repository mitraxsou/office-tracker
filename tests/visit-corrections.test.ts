import { describe, expect, it } from "vitest";
import {
  buildCorrectionSummary,
  formatCorrectionChange,
  isValidCorrectionStatus,
  parseCorrectionSummary,
  parseVisitSnapshot,
  snapshotsDiffer,
  visitToSnapshot,
} from "../src/lib/visit-corrections";

describe("isValidCorrectionStatus", () => {
  it("accepts open, resolved, closed", () => {
    expect(isValidCorrectionStatus("open")).toBe(true);
    expect(isValidCorrectionStatus("resolved")).toBe(true);
    expect(isValidCorrectionStatus("closed")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidCorrectionStatus("pending")).toBe(false);
    expect(isValidCorrectionStatus("")).toBe(false);
  });
});

describe("visit snapshot helpers", () => {
  const visit = {
    startAt: new Date("2026-08-28T04:00:00.000Z"),
    endAt: new Date("2026-08-28T10:00:00.000Z"),
    source: "wifi",
    ssid: "OfficeConnect",
  };

  it("round-trips visit snapshot JSON", () => {
    const snapshot = visitToSnapshot(visit);
    const raw = JSON.stringify(snapshot);
    const parsed = parseVisitSnapshot(raw);
    expect(parsed).toEqual(snapshot);
  });

  it("detects snapshot differences", () => {
    const before = visitToSnapshot(visit);
    const after = visitToSnapshot({ ...visit, endAt: new Date("2026-08-28T11:00:00.000Z") });
    expect(snapshotsDiffer(before, after)).toBe(true);
    expect(snapshotsDiffer(before, before)).toBe(false);
  });
});

describe("buildCorrectionSummary", () => {
  it("returns null when no before or after", () => {
    expect(buildCorrectionSummary({})).toBeNull();
  });

  it("builds summary with before and after", () => {
    const before = {
      startAt: "2026-08-28T04:00:00.000Z",
      endAt: "2026-08-28T10:00:00.000Z",
      source: "wifi",
      ssid: "OfficeConnect",
    };
    const after = { ...before, endAt: "2026-08-28T11:00:00.000Z" };
    const summary = buildCorrectionSummary({ visitId: "v1", before, after });
    expect(summary?.visitId).toBe("v1");
    expect(parseCorrectionSummary(JSON.stringify(summary))).toEqual(summary);
  });
});

describe("formatCorrectionChange", () => {
  it("lists changed visit fields", () => {
    const summary = {
      before: {
        startAt: "2026-08-28T04:00:00.000Z",
        endAt: "2026-08-28T10:00:00.000Z",
        source: "wifi",
        ssid: "OfficeConnect",
      },
      after: {
        startAt: "2026-08-28T04:00:00.000Z",
        endAt: "2026-08-28T11:00:00.000Z",
        source: "wifi",
        ssid: "OfficeConnect",
      },
    };
    const lines = formatCorrectionChange(summary, "UTC");
    expect(lines.some((l) => l.startsWith("End:"))).toBe(true);
    expect(lines.some((l) => l.includes("→"))).toBe(true);
  });
});
