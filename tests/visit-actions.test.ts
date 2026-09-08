import { describe, expect, it } from "vitest";
import {
  canUserDeleteVisit,
  deleteVisitDeniedReason,
} from "../src/lib/visit-actions";
import { VISIT_DELETE_DENIED_MESSAGE } from "../src/lib/visit-preservation";

describe("visit-actions", () => {
  const userId = "user-1";

  it("never allows visit deletion", () => {
    expect(canUserDeleteVisit({ userId, source: "manual" }, userId)).toBe(false);
    expect(canUserDeleteVisit({ userId, source: "wifi" }, userId)).toBe(false);
    expect(deleteVisitDeniedReason({ userId, source: "manual" }, userId)).toBe(
      VISIT_DELETE_DENIED_MESSAGE,
    );
  });
});
