import { describe, expect, it } from "vitest";
import { parseReportsTab } from "../src/components/ReportsPageClient";

describe("parseReportsTab", () => {
  it("defaults to summary", () => {
    expect(parseReportsTab(null)).toBe("summary");
    expect(parseReportsTab("")).toBe("summary");
    expect(parseReportsTab("summary")).toBe("summary");
    expect(parseReportsTab("unknown")).toBe("summary");
  });

  it("accepts visits and corrections", () => {
    expect(parseReportsTab("visits")).toBe("visits");
    expect(parseReportsTab("corrections")).toBe("corrections");
  });
});
