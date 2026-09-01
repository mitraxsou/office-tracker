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

export function deleteVisitDeniedReason(visit: VisitOwnership, userId: string): string | null {
  if (visit.userId !== userId) return "You can only delete your own visits";
  if (visit.source !== "manual") return "Only manual visits can be deleted. Report agent visits to admin.";
  return null;
}
