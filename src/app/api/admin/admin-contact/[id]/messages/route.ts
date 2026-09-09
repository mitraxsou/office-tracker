import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { addAdminContactMessage } from "@/lib/admin-contact";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { body?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.body ?? body.message;
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const result = await addAdminContactMessage({
    threadId: id,
    authorId: admin.id,
    authorRole: "admin",
    body: text,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
