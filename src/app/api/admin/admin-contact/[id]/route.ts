import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { resolveAdminContactSubmission } from "@/lib/admin-contact";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { status?: string; adminResponse?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status ?? "resolved";
  if (status !== "open" && status !== "resolved") {
    return NextResponse.json({ error: "status must be open or resolved" }, { status: 400 });
  }

  const result = await resolveAdminContactSubmission({
    adminId: admin.id,
    submissionId: id,
    status,
    adminResponse: body.adminResponse,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ submission: result.submission });
}
