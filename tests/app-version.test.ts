import { describe, expect, it } from "vitest";
import { APP_CHANGELOG, APP_VERSION, getCurrentRelease } from "../src/lib/app-version";

describe("app version", () => {
  it("uses a semantic version and matching current release", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(getCurrentRelease().version).toBe(APP_VERSION);
    expect(APP_CHANGELOG[0].bullets.length).toBeGreaterThan(0);
  });
});
