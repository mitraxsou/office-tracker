import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminContactThread } from "@/lib/admin-contact-server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await getAdminContactThread(id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ thread: result.thread });
}
