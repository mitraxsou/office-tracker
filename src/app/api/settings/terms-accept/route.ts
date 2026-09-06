import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentLegalVersion, getPublishedLegalConfig } from "@/lib/legal-config";
import {
  sanitizeTermsAcceptNextPath,
  userNeedsTermsAcceptance,
} from "@/lib/terms-acceptance";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { next?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const nextPath = sanitizeTermsAcceptNextPath(body.next);
  const currentLegalVersion = await getCurrentLegalVersion();

  if (!userNeedsTermsAcceptance(user, currentLegalVersion)) {
    return NextResponse.json({ ok: true, redirectTo: nextPath });
  }

  const acceptedAt = new Date();
  const legal = await getPublishedLegalConfig();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      termsAcceptedAt: acceptedAt,
      termsAcceptedVersion: legal.legalVersion,
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "terms.accepted",
    targetUserId: user.id,
    details: {
      acceptedAt: acceptedAt.toISOString(),
      legalVersion: legal.legalVersion,
      previousVersion: user.termsAcceptedVersion,
    },
  });

  return NextResponse.json({ ok: true, redirectTo: nextPath });
}
