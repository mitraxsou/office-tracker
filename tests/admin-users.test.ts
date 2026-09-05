import { describe, expect, it } from "vitest";
import {
  ADMIN_PROFILE_CHANGE_REQUIRES_APPROVAL,
  buildUserSearchWhere,
  getAdminDirectProfileUpdateError,
  parseAdminUsersListParams,
} from "../src/lib/admin-users";

describe("parseAdminUsersListParams", () => {
  it("defaults to page 1 and pageSize 20", () => {
    const params = parseAdminUsersListParams(new URLSearchParams());
    expect(params).toEqual({
      all: false,
      search: "",
      page: 1,
      pageSize: 20,
      source: undefined,
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

  it("filters self-registered otp users", () => {
    expect(buildUserSearchWhere("", "otp_self")).toEqual({
      registrationSource: "otp_self",
    });
    expect(buildUserSearchWhere("bob", "otp_self")).toEqual({
      AND: [
        {
          OR: [
            { email: { contains: "bob", mode: "insensitive" } },
            { name: { contains: "bob", mode: "insensitive" } },
          ],
        },
        { registrationSource: "otp_self" },
      ],
    });
  });
});

describe("getAdminDirectProfileUpdateError", () => {
  it("rejects direct name updates", () => {
    expect(getAdminDirectProfileUpdateError({ name: "Alice Smith" })).toBe(
      ADMIN_PROFILE_CHANGE_REQUIRES_APPROVAL,
    );
  });

  it("rejects direct email updates", () => {
    expect(getAdminDirectProfileUpdateError({ email: "alice@uk.pwc.com" })).toBe(
      ADMIN_PROFILE_CHANGE_REQUIRES_APPROVAL,
    );
  });

  it("allows role-only updates", () => {
    expect(getAdminDirectProfileUpdateError({})).toBeNull();
  });
});
