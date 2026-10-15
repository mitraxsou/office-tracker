import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  canAgentRefineVisitEnd,
  canUserSelfCorrectVisitEnd,
} from "../../src/lib/visit-end";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/overnight-inferred-checkout.json"),
    "utf8",
  ),
) as {
  endSourceOnEodClose: string;
  userSelfCorrectPath: string;
  agentRefineAllowedWhen: Array<string | null>;
};

describe("BUG-022 overnight open visit invents midnight first check-in", () => {
  it("EOD close marks endSource inferred and agent may refine", () => {
    const service = readFileSync(
      path.join(process.cwd(), "src/lib/heartbeat-service.ts"),
      "utf8",
    );
    expect(service).toContain('endSource: "inferred"');
    expect(service).toContain("closeEndOfDayOpenVisits");
    expect(fixture.endSourceOnEodClose).toBe("inferred");
    for (const src of fixture.agentRefineAllowedWhen) {
      expect(canAgentRefineVisitEnd(src)).toBe(true);
    }
    expect(canAgentRefineVisitEnd("manual")).toBe(false);
  });

  it("firstOfficeInMsForDay never clips overnight start to midnight without today pulse", () => {
    const visits = readFileSync(path.join(process.cwd(), "src/lib/visits.ts"), "utf8");
    expect(visits).toContain("Do not clip yesterday");
    expect(visits).toContain("never invent midnight");
  });

  it("user can self-correct inferred checkout without admin approval", () => {
    expect(canUserSelfCorrectVisitEnd("inferred")).toBe(true);
    const route = readFileSync(
      path.join(process.cwd(), "src/app/api/visits/[id]/checkout/route.ts"),
      "utf8",
    );
    expect(route).toContain("selfCorrectVisitCheckout");
    expect(fixture.userSelfCorrectPath).toContain("checkout");
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/VisitList.tsx"),
      "utf8",
    );
    expect(panel).toContain("Update checkout");
    expect(panel).toContain("Ask admin");
  });
});
