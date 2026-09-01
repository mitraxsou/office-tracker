import { describe, expect, it } from "vitest";
import {
  canUserDeleteVisit,
  canUserReportVisit,
  deleteVisitDeniedReason,
} from "../src/lib/visit-actions";

describe("visit-actions", () => {
  const userId = "user-1";
  const otherUserId = "user-2";

  describe("canUserDeleteVisit", () => {
    it("allows deleting own manual visit", () => {
      expect(canUserDeleteVisit({ userId, source: "manual" }, userId)).toBe(true);
    });

    it("denies deleting wifi visit", () => {
      expect(canUserDeleteVisit({ userId, source: "wifi" }, userId)).toBe(false);
    });

    it("denies deleting another user's manual visit", () => {
      expect(canUserDeleteVisit({ userId: otherUserId, source: "manual" }, userId)).toBe(false);
    });
  });

  describe("canUserReportVisit", () => {
    it("allows reporting own visit", () => {
      expect(canUserReportVisit({ userId }, userId)).toBe(true);
    });

    it("denies reporting another user's visit", () => {
      expect(canUserReportVisit({ userId: otherUserId }, userId)).toBe(false);
    });
  });

  describe("deleteVisitDeniedReason", () => {
    it("returns null when delete is allowed", () => {
      expect(deleteVisitDeniedReason({ userId, source: "manual" }, userId)).toBeNull();
    });

    it("returns ownership error for another user's visit", () => {
      expect(deleteVisitDeniedReason({ userId: otherUserId, source: "manual" }, userId)).toBe(
        "You can only delete your own visits",
      );
    });

    it("returns source error for agent visit", () => {
      expect(deleteVisitDeniedReason({ userId, source: "wifi" }, userId)).toBe(
        "Only manual visits can be deleted. Report agent visits to admin.",
      );
    });
  });
});
