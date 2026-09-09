import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createAdminContactSubmission,
  listUserAdminContactSubmissions,
} from "@/lib/admin-contact";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await listUserAdminContactSubmissions(user.id);
  return NextResponse.json({ submissions });
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

  const result = await createAdminContactSubmission({
    userId: user.id,
    category: body.category,
    message: body.message,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ submission: result.submission }, { status: 201 });
}
