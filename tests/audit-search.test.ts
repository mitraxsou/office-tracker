import { describe, expect, it } from "vitest";
import { buildAuditWhere, normalizeAuditSearch, summarizeAuditDetails } from "../src/lib/audit-search";

describe("audit search filters", () => {
  it("normalizes pagination and date inputs", () => {
    expect(normalizeAuditSearch({ page: "-3", from: "not-a-day", to: "2026-09-03" })).toEqual({
      target: "",
      actor: "",
      action: "",
      from: "",
      to: "2026-09-03",
      page: 1,
    });
  });

  it("builds server-side actor, target, action, and date filters", () => {
    const where = buildAuditWhere({
      target: "person@pwc.com",
      actor: "admin",
      action: "config",
      from: "2026-09-01",
      to: "2026-09-03",
    });
    expect(where.targetUser).toBeDefined();
    expect(where.actor).toBeDefined();
    expect(where.action).toBeDefined();
    expect(where.createdAt).toEqual({
      gte: new Date("2026-09-01T00:00:00.000Z"),
      lte: new Date("2026-09-03T23:59:59.999Z"),
    });
  });

  it("summarizes structured details", () => {
    expect(summarizeAuditDetails('{"hoursTarget":5,"scope":"global"}')).toBe(
      "hoursTarget: 5, scope: global",
    );
  });
});
