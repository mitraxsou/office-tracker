import { describe, expect, it } from "vitest";
import {
  filterGlobalSearch,
  groupSearchResults,
  matchesSearchEntry,
} from "../src/lib/global-search";

describe("global search filters", () => {
  it("matches entries by label and keywords", () => {
    expect(matchesSearchEntry(
      {
        id: "x",
        label: "Report a bug",
        href: "/contact-admin?category=issue",
        keywords: ["bug", "broken"],
        group: "actions",
      },
      "bug report",
    )).toBe(true);
    expect(matchesSearchEntry(
      {
        id: "x",
        label: "Report a bug",
        href: "/contact-admin?category=issue",
        keywords: ["bug", "broken"],
        group: "actions",
      },
      "feature",
    )).toBe(false);
  });

  it("hides admin-only entries for regular users", () => {
    const userResults = filterGlobalSearch("admin", { isAdmin: false });
    expect(userResults.some((entry) => entry.id === "admin-inbox")).toBe(false);
    expect(userResults.some((entry) => entry.id === "action-report-bug")).toBe(true);

    const agentStatusResults = filterGlobalSearch("agent status", { isAdmin: false });
    expect(agentStatusResults.some((entry) => entry.id === "settings-agent-status")).toBe(false);
  });

  it("includes admin-only entries for admins", () => {
    const adminResults = filterGlobalSearch("inbox", { isAdmin: true });
    expect(adminResults.some((entry) => entry.id === "admin-inbox")).toBe(true);
  });

  it("groups results in a stable order", () => {
    const grouped = groupSearchResults(
      filterGlobalSearch("", { isAdmin: true, limit: 8 }),
    );
    expect(grouped[0]?.group).toBe("actions");
    expect(grouped.some((group) => group.group === "pages")).toBe(true);
  });
});
