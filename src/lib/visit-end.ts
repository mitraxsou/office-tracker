/**
 * Visit checkout provenance.
 *
 * - agent: exact end from agent visit_end / out-of-office pulse
 * - inferred: server closed from last same-day signal (lid close without sync)
 * - manual: user self-corrected or quick check-out
 * - admin: admin Correct this day / visit edit
 */

export const VISIT_END_SOURCES = ["agent", "inferred", "manual", "admin"] as const;
export type VisitEndSource = (typeof VISIT_END_SOURCES)[number];

export function isVisitEndSource(value: string | null | undefined): value is VisitEndSource {
  return (
    value === "agent" ||
    value === "inferred" ||
    value === "manual" ||
    value === "admin"
  );
}

/** Inferred (or legacy unknown) ends may be refined by a later agent visit_end. */
export function canAgentRefineVisitEnd(endSource: string | null | undefined): boolean {
  return endSource === "inferred" || endSource == null;
}

/** User may self-correct checkout without admin approval. */
export function canUserSelfCorrectVisitEnd(endSource: string | null | undefined): boolean {
  return endSource === "inferred" || endSource == null;
}

export function inferredCheckoutNotice(endSource: string | null | undefined): string | null {
  if (endSource !== "inferred") return null;
  return "Checkout time was estimated from the last office signal that day (laptop may have closed before sync). You can update it yourself, or ask an admin.";
}
