import { describe, expect, it } from "vitest";
import { totalAdminInboxCount } from "../src/lib/admin-inbox";

describe("admin inbox count", () => {
  it("adds all open request queues", () => {
    expect(
      totalAdminInboxCount({
        visit_correction: 4,
        manual_visit: 1,
        timezone_change: 2,
        profile_change: 1,
        compliance_exemption: 3,
        device_removal: 2,
        agent_token_regenerate: 1,
        admin_contact: 1,
        prior_compliance: 2,
        account_access: 3,
      }),
    ).toBe(20);
  });
});
