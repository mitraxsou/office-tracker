import { describe, expect, it } from "vitest";
import {
  buildUserSearchWhere,
  parseAdminUsersListParams,
  validateAdminDirectProfileUpdate,
} from "../src/lib/admin-users";

describe("parseAdminUsersListParams", () => {
  it("defaults to page 1 and pageSize 20", () => {
    const params = parseAdminUsersListParams(new URLSearchParams());
    expect(params).toEqual({
      all: false,
      search: "",
      page: 1,
      pageSize: 20,
    });
  });

  it("parses search, page, and pageSize", () => {
    const params = parseAdminUsersListParams(
      new URLSearchParams("search=alice&page=3&pageSize=50"),
    );
    expect(params.search).toBe("alice");
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(50);
  });

  it("clamps invalid page and pageSize", () => {
    const params = parseAdminUsersListParams(
      new URLSearchParams("page=0&pageSize=500"),
    );
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(100);
  });

  it("supports all=true for full list consumers", () => {
    const params = parseAdminUsersListParams(new URLSearchParams("all=true"));
    expect(params.all).toBe(true);
  });
});

describe("buildUserSearchWhere", () => {
  it("returns empty object when search is blank", () => {
    expect(buildUserSearchWhere("")).toEqual({});
    expect(buildUserSearchWhere("   ")).toEqual({});
  });

  it("searches email and name case-insensitively", () => {
    expect(buildUserSearchWhere("bob")).toEqual({
      OR: [
        { email: { contains: "bob", mode: "insensitive" } },
        { name: { contains: "bob", mode: "insensitive" } },
      ],
    });
  });
});

describe("validateAdminDirectProfileUpdate", () => {
  it("accepts valid name and email changes", () => {
    const result = validateAdminDirectProfileUpdate({
      currentName: "Alice",
      currentEmail: "alice@pwc.com",
      name: "Alice Smith",
      email: "alice.smith@uk.pwc.com",
    });
    expect(result).toEqual({
      updates: {
        name: "Alice Smith",
        email: "alice.smith@uk.pwc.com",
      },
    });
  });

  it("rejects non-PwC email", () => {
    const result = validateAdminDirectProfileUpdate({
      currentName: "Alice",
      currentEmail: "alice@pwc.com",
      email: "alice@gmail.com",
    });
    expect(result).toEqual({
      error:
        "Email must be a PwC address (for example user@pwc.com or user@uk.pwc.com)",
    });
  });

  it("rejects when nothing changed", () => {
    const result = validateAdminDirectProfileUpdate({
      currentName: "Alice",
      currentEmail: "alice@pwc.com",
      name: "Alice",
      email: "alice@pwc.com",
    });
    expect(result).toEqual({ error: "No profile changes to apply" });
  });
});
