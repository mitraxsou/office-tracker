import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { dayKeyInTimezone } from "./timezone-dates";
import { canUserSelfCorrectVisitEnd } from "./visit-end";
import { validateVisitTimestamps } from "./visit-validation";

/**
 * User self-serve: correct an inferred (or legacy) checkout without admin approval.
 * Confined to the visit's calendar day in the user's timezone.
 */
export async function selfCorrectVisitCheckout(params: {
  userId: string;
  visitId: string;
  endAt: Date;
  timezone: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const visit = await prisma.visit.findFirst({
    where: { id: params.visitId, userId: params.userId },
  });
  if (!visit) {
    return { ok: false, error: "Visit not found", status: 404 };
  }
  if (!visit.endAt) {
    return {
      ok: false,
      error: "Visit is still open. Use Check out, or wait for the agent.",
      status: 400,
    };
  }
  if (!canUserSelfCorrectVisitEnd(visit.endSource)) {
    return {
      ok: false,
      error:
        "This checkout was set by the agent or an admin. Report an issue if it is wrong.",
      status: 400,
    };
  }

  const now = new Date();
  if (params.endAt.getTime() > now.getTime()) {
    return { ok: false, error: "Checkout cannot be in the future", status: 400 };
  }

  const timestampError = validateVisitTimestamps(visit.startAt, params.endAt);
  if (timestampError) {
    return { ok: false, error: timestampError, status: 400 };
  }

  const startDay = dayKeyInTimezone(visit.startAt, params.timezone);
  const endDay = dayKeyInTimezone(params.endAt, params.timezone);
  if (endDay !== startDay) {
    return {
      ok: false,
      error: "Checkout must stay on the same calendar day as check-in",
      status: 400,
    };
  }

  const before = {
    endAt: visit.endAt.toISOString(),
    endSource: visit.endSource,
  };

  await prisma.visit.update({
    where: { id: visit.id },
    data: { endAt: params.endAt, endSource: "manual" },
  });

  await logAuditEvent({
    actorId: params.userId,
    action: "visit_update",
    targetUserId: params.userId,
    details: {
      visitId: visit.id,
      selfCorrectCheckout: true,
      before,
      after: { endAt: params.endAt.toISOString(), endSource: "manual" },
    },
  });

  return { ok: true };
}
