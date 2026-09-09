import { describe, expect, it } from "vitest";
import {
  APP_CHANGELOG,
  APP_VERSION,
  getCurrentRelease,
  getVisibleReleaseBullets,
} from "../src/lib/app-version";

describe("app version", () => {
  it("uses a semantic version and matching current release", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(getCurrentRelease().version).toBe(APP_VERSION);
    expect(getCurrentRelease().userBullets.length).toBeGreaterThan(0);
    expect(getCurrentRelease().adminBullets.length).toBeGreaterThan(0);
  });

  it("hides admin release notes from regular users", () => {
    const release = getCurrentRelease();
    const userBullets = getVisibleReleaseBullets(release, false);
    const adminBullets = getVisibleReleaseBullets(release, true);

    expect(userBullets).toEqual(release.userBullets);
    expect(adminBullets).toEqual([...release.userBullets, ...release.adminBullets]);
    expect(userBullets.some((b) => b.includes("admin"))).toBe(false);
    expect(adminBullets.length).toBeGreaterThan(userBullets.length);
  });

  it("keeps prior releases in changelog history", () => {
    expect(APP_CHANGELOG.length).toBeGreaterThan(2);
    expect(APP_CHANGELOG[1].version).toBe("1.5.1");
    expect(APP_CHANGELOG[2].version).toBe("1.5.0");
    expect(APP_CHANGELOG[3].version).toBe("1.4.0");
  });
});
