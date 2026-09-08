import { VISIT_DELETE_DENIED_MESSAGE } from "./visit-preservation";

export type VisitOwnership = {
  userId: string;
  source: string;
};

/** Office visit records are immutable compliance data. */
export function canUserDeleteVisit(_visit: VisitOwnership, _userId: string): boolean {
  return false;
}

export function canUserReportVisit(visit: { userId: string }, userId: string): boolean {
  return visit.userId === userId;
}

export function deleteVisitDeniedReason(_visit: VisitOwnership, _userId: string): string {
  return VISIT_DELETE_DENIED_MESSAGE;
}
