import { describe, expect, it } from "vitest";
import {
  canUserDeleteVisit,
  deleteVisitDeniedReason,
} from "../src/lib/visit-actions";
import {
  VISIT_DELETE_DENIED_MESSAGE,
  VISIT_DELETE_DENIED_NOT_OWNER_MESSAGE,
} from "../src/lib/visit-preservation";

describe("visit-actions", () => {
  const userId = "user-1";

  it("allows users to delete their own manual visits", () => {
    expect(canUserDeleteVisit({ userId, source: "manual" }, userId)).toBe(true);
    expect(deleteVisitDeniedReason({ userId, source: "manual" }, userId)).toBeNull();
  });

  it("denies deleting agent-recorded visits", () => {
    expect(canUserDeleteVisit({ userId, source: "wifi" }, userId)).toBe(false);
    expect(deleteVisitDeniedReason({ userId, source: "wifi" }, userId)).toBe(
      VISIT_DELETE_DENIED_MESSAGE,
    );
  });

  it("denies deleting another user's visits", () => {
    expect(canUserDeleteVisit({ userId: "other", source: "manual" }, userId)).toBe(false);
    expect(deleteVisitDeniedReason({ userId: "other", source: "manual" }, userId)).toBe(
      VISIT_DELETE_DENIED_NOT_OWNER_MESSAGE,
    );
  });
});
