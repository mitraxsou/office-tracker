import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { resolveComplianceExemptionRequest } from "@/lib/compliance-exemptions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { status?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status ?? "approved";
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
  }

  const result = await resolveComplianceExemptionRequest({
    adminId: admin.id,
    requestId: id,
    status,
    adminNote: body.adminNote,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ request: result.request });
}
