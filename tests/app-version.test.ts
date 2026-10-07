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
    expect(APP_CHANGELOG[0].version).toBe(APP_VERSION);
    expect(APP_CHANGELOG[1].version).toBe("1.5.31");
    expect(APP_CHANGELOG[2].version).toBe("1.5.30");
    expect(APP_CHANGELOG[3].version).toBe("1.5.29");
    expect(APP_CHANGELOG[4].version).toBe("1.5.28");
    expect(APP_CHANGELOG[5].version).toBe("1.5.27");
    expect(APP_CHANGELOG[6].version).toBe("1.5.26");
    expect(APP_CHANGELOG[7].version).toBe("1.5.25");
    expect(APP_CHANGELOG[8].version).toBe("1.5.24");
    expect(APP_CHANGELOG[9].version).toBe("1.5.23");
    expect(APP_CHANGELOG[10].version).toBe("1.5.22");
    expect(APP_CHANGELOG[11].version).toBe("1.5.21");
    expect(APP_CHANGELOG[12].version).toBe("1.5.20");
    expect(APP_CHANGELOG[13].version).toBe("1.5.19");
    expect(APP_CHANGELOG[14].version).toBe("1.5.18");
    expect(APP_CHANGELOG[15].version).toBe("1.5.17");
    expect(APP_CHANGELOG[16].version).toBe("1.5.16");
    expect(APP_CHANGELOG[17].version).toBe("1.5.4");
    expect(APP_CHANGELOG[18].version).toBe("1.5.3");
    expect(APP_CHANGELOG[19].version).toBe("1.5.2");
    expect(APP_CHANGELOG[20].version).toBe("1.5.1");
    expect(APP_CHANGELOG[21].version).toBe("1.5.0");
    expect(APP_CHANGELOG[22].version).toBe("1.4.0");
  });
});
