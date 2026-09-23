import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const bugsDir = path.join(process.cwd(), "tests", "bugs");
const catalogPath = path.join(bugsDir, "catalog.json");

type CatalogCase = {
  id: string;
  title: string;
  date: string;
  severity: string;
  area: string;
  reproSummary: string;
  assertion: string;
  fixture: string | null;
  testFile: string;
  relatedTests: string[];
  status: string;
  skipReason: string | null;
};

type Catalog = {
  version: number;
  cases: CatalogCase[];
};

const AREAS = new Set([
  "agent-update",
  "alerts",
  "visits",
  "admin",
  "wifi",
  "auth",
  "core",
]);
const STATUSES = new Set(["open", "fixed", "guarded", "manual"]);
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);

describe("bugs catalog integrity", () => {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;

  it("has a non-empty versioned case list", () => {
    expect(catalog.version).toBeGreaterThanOrEqual(1);
    expect(catalog.cases.length).toBeGreaterThanOrEqual(8);
  });

  it("uses unique ids and valid enums", () => {
    const ids = catalog.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of catalog.cases) {
      expect(c.title.length).toBeGreaterThan(5);
      expect(AREAS.has(c.area)).toBe(true);
      expect(STATUSES.has(c.status)).toBe(true);
      expect(SEVERITIES.has(c.severity)).toBe(true);
      expect(c.testFile.startsWith("tests/bugs/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), c.testFile))).toBe(true);
      if (c.fixture) {
        expect(existsSync(path.join(bugsDir, c.fixture))).toBe(true);
      }
      if (c.status === "manual") {
        expect(c.skipReason).toBeTruthy();
      }
    }
  });

  it("indexes the historical incidents required by the skill", () => {
    const titles = catalog.cases.map((c) => c.title.toLowerCase()).join("\n");
    expect(titles).toContain("missing files");
    expect(titles).toContain("self-kill");
    expect(titles).toContain("stale");
    expect(titles).toContain("invalid times");
    expect(titles).toContain("hours_started");
    expect(titles).toContain("webhook");
    expect(titles).toContain("once-per-day");
    expect(titles).toContain("office-tracker-theta");
  });
});
