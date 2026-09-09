import { describe, expect, it } from "vitest";
import { totalAdminInboxCount } from "../src/lib/admin-inbox";

describe("admin inbox count", () => {
  it("adds all open request queues", () => {
    expect(
      totalAdminInboxCount({
        visit_correction: 4,
        timezone_change: 2,
        profile_change: 1,
        compliance_exemption: 3,
        device_removal: 2,
        admin_contact: 1,
      }),
    ).toBe(13);
  });
});
