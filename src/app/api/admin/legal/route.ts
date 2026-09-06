import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  formatLegalUpdatedLabel,
  getAdminLegalDraft,
  updateLegalDraft,
  validatePrivacySections,
  validateTermsSections,
} from "@/lib/legal-config";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const draft = await getAdminLegalDraft();
  return NextResponse.json({
    legalVersion: draft.legalVersion,
    publishedAt: draft.publishedAt?.toISOString() ?? null,
    updatedLabel: formatLegalUpdatedLabel(draft.publishedAt),
    publishedChangeSummary: draft.publishedChangeSummary,
    draft: {
      termsSections: draft.draftTermsSections,
      privacySections: draft.draftPrivacySections,
      changeSummary: draft.draftChangeSummary,
    },
    published: {
      termsSections: draft.publishedTermsSections,
      privacySections: draft.publishedPrivacySections,
    },
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    termsSections?: unknown;
    privacySections?: unknown;
    changeSummary?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const termsSections = validateTermsSections(body.termsSections);
  if (!termsSections) {
    return NextResponse.json({ error: "Invalid terms sections" }, { status: 400 });
  }

  const privacySections = validatePrivacySections(body.privacySections);
  if (!privacySections) {
    return NextResponse.json({ error: "Invalid privacy sections" }, { status: 400 });
  }

  if (body.changeSummary !== undefined && body.changeSummary !== null) {
    if (typeof body.changeSummary !== "string") {
      return NextResponse.json({ error: "Invalid changeSummary" }, { status: 400 });
    }
    if (body.changeSummary.length > 2000) {
      return NextResponse.json({ error: "changeSummary is too long" }, { status: 400 });
    }
  }

  await updateLegalDraft({
    termsSections,
    privacySections,
    changeSummary: body.changeSummary,
  });

  const draft = await getAdminLegalDraft();
  return NextResponse.json({
    ok: true,
    draft: {
      termsSections: draft.draftTermsSections,
      privacySections: draft.draftPrivacySections,
      changeSummary: draft.draftChangeSummary,
    },
  });
}
