import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createAdminContactThread,
  listUserAdminContactThreads,
} from "@/lib/admin-contact";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await listUserAdminContactThreads(user.id);
  return NextResponse.json({ threads, submissions: threads });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { category?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.category || !body.message) {
    return NextResponse.json({ error: "category and message required" }, { status: 400 });
  }

  const result = await createAdminContactThread({
    userId: user.id,
    category: body.category,
    message: body.message,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ thread: result.thread, submission: result.thread }, { status: 201 });
}
