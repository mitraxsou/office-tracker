import { describe, expect, it } from "vitest";
import { timezoneOptionsForUser, USER_TIMEZONE_OPTIONS } from "../src/lib/constants";

describe("timezoneOptionsForUser", () => {
  it("returns curated list when current is in list", () => {
    const opts = timezoneOptionsForUser("Asia/Kolkata");
    expect(opts).toEqual(USER_TIMEZONE_OPTIONS);
  });

  it("prepends unknown current timezone", () => {
    const opts = timezoneOptionsForUser("Pacific/Auckland");
    expect(opts[0].value).toBe("Pacific/Auckland");
    expect(opts.length).toBe(USER_TIMEZONE_OPTIONS.length + 1);
  });
});
