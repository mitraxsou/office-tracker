import { describe, expect, it } from "vitest";
import { ADMIN_GUIDE_SECTIONS } from "../src/lib/admin-guide-content";
import { ADMIN_SETTINGS_HREF } from "../src/lib/admin-settings-hash";

describe("admin guide user-report logs", () => {
  it("documents when to use each log and links Global settings controls", () => {
    const agent = ADMIN_GUIDE_SECTIONS.find((section) => section.id === "agent");
    expect(agent).toBeDefined();
    const headings = agent!.blocks
      .filter((block) => block.type === "subheading")
      .map((block) => block.text);
    expect(headings).toContain("User report logs (when to use)");

    const links = agent!.blocks.find(
      (block) =>
        block.type === "links" &&
        block.items.some((item) => item.href === ADMIN_SETTINGS_HREF.diagnosticRetention),
    );
    expect(links?.type).toBe("links");
    if (links?.type !== "links") throw new Error("expected links block");
    const hrefs = links.items.map((item) => item.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        ADMIN_SETTINGS_HREF.diagnosticRetention,
        ADMIN_SETTINGS_HREF.agentSync,
        ADMIN_SETTINGS_HREF.cronJobs,
        ADMIN_SETTINGS_HREF.dataMaintenance,
      ]),
    );
  });
});
