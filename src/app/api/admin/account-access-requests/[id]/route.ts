import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  approveAccountAccessRequest,
  rejectAccountAccessRequest,
} from "@/lib/account-access-requests";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: { action?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : null;
  if (!action) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  if (action === "approve") {
    const result = await approveAccountAccessRequest({
      id,
      adminId: admin.id,
      adminNote: body.adminNote,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      userId: result.userId,
      alreadyExisted: result.alreadyExisted,
    });
  }

  const result = await rejectAccountAccessRequest({
    id,
    adminId: admin.id,
    adminNote: body.adminNote,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
