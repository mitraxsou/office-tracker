import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getAdminLegalDraft, publishLegalConfig } from "@/lib/legal-config";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await getAdminLegalDraft();

  try {
    const published = await publishLegalConfig(admin.id);
    await logAuditEvent({
      actorId: admin.id,
      action: "legal.publish",
      details: {
        previousVersion: before.legalVersion,
        newVersion: published.legalVersion,
        changeSummary: published.changeSummary,
      },
    });

    return NextResponse.json({
      ok: true,
      legalVersion: published.legalVersion,
      publishedAt: published.publishedAt?.toISOString() ?? null,
      changeSummary: published.changeSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
