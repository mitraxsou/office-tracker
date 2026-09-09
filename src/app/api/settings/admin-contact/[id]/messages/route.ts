import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAdminContactMessage } from "@/lib/admin-contact";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    authorId: user.id,
    authorRole: "user",
    body: text,
    threadUserId: user.id,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
