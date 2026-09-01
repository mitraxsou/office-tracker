import { describe, expect, it } from "vitest";
import { parseReportRange } from "@/lib/report-range";

describe("parseReportRange", () => {
  it("parses month query param", () => {
    const params = new URLSearchParams("month=2026-09");
    const range = parseReportRange(params, "Asia/Kolkata");
    expect(range.monthKey).toBe("2026-09");
    expect(range.fromKey).toBe("2026-09-01");
    expect(range.toKey).toMatch(/^2026-09-/);
  });

  it("defaults to current month when no params", () => {
    const range = parseReportRange(new URLSearchParams(), "Asia/Kolkata");
    expect(range.monthKey).toMatch(/^\d{4}-\d{2}$/);
    expect(range.fromKey.endsWith("-01")).toBe(true);
  });
});
