import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createIntegrationApiKey,
  listIntegrationApiKeys,
  revokeIntegrationApiKey,
} from "@/lib/integration-api-keys";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await listIntegrationApiKeys();
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  try {
    const { record, plainKey } = await createIntegrationApiKey(label, admin.id);

    await logAuditEvent({
      actorId: admin.id,
      action: "integration_key_create",
      details: { keyId: record.id, label: record.label, keyPrefix: record.keyPrefix },
    });

    return NextResponse.json({
      key: plainKey,
      id: record.id,
      label: record.label,
      keyPrefix: record.keyPrefix,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create key";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const revoked = await revokeIntegrationApiKey(id);
  if (!revoked) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  await logAuditEvent({
    actorId: admin.id,
    action: "integration_key_revoke",
    details: { keyId: id, label: revoked.label, keyPrefix: revoked.keyPrefix },
  });

  return NextResponse.json({ ok: true });
}
