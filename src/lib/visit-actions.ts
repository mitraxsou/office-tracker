import {
  VISIT_DELETE_DENIED_MESSAGE,
  VISIT_DELETE_DENIED_NOT_OWNER_MESSAGE,
} from "./visit-preservation";

export type VisitOwnership = {
  userId: string;
  source: string;
};

export function canUserDeleteVisit(visit: VisitOwnership, userId: string): boolean {
  return visit.userId === userId && visit.source === "manual";
}

export function canUserReportVisit(visit: { userId: string }, userId: string): boolean {
  return visit.userId === userId;
}

/** Returns an error message when deletion is denied, or null when allowed. */
export function deleteVisitDeniedReason(
  visit: VisitOwnership,
  userId: string,
): string | null {
  if (visit.userId !== userId) {
    return VISIT_DELETE_DENIED_NOT_OWNER_MESSAGE;
  }
  if (visit.source !== "manual") {
    return VISIT_DELETE_DENIED_MESSAGE;
  }
  return null;
}
