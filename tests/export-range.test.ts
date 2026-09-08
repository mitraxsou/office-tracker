import { describe, expect, it } from "vitest";
import { fiscalYearBounds, monthKeysBetween, parseExportRange } from "../src/lib/export-range";

describe("export-range", () => {
  it("parses India FY bounds", () => {
    const fy = fiscalYearBounds("2025-26");
    expect(fy).not.toBeNull();
    expect(fy!.fromKey).toBe("2025-04-01");
    expect(fy!.toKey).toBe("2026-03-31");
    expect(fy!.label).toBe("FY 2025-26");
  });

  it("lists months across a fiscal year", () => {
    const keys = monthKeysBetween("2025-04-01", "2026-03-31");
    expect(keys[0]).toBe("2025-04");
    expect(keys[keys.length - 1]).toBe("2026-03");
    expect(keys).toHaveLength(12);
  });

  it("parses month export range", () => {
    const range = parseExportRange(new URLSearchParams("month=2026-09"));
    expect(range).not.toBeNull();
    expect(range!.periodKind).toBe("month");
    expect(range!.fromKey).toBe("2026-09-01");
    expect(range!.toKey).toBe("2026-09-30");
  });

  it("parses fy export range", () => {
    const range = parseExportRange(new URLSearchParams("fy=2025-26"));
    expect(range).not.toBeNull();
    expect(range!.periodKind).toBe("fy");
    expect(range!.fromKey).toBe("2025-04-01");
    expect(range!.toKey).toBe("2026-03-31");
  });
});
