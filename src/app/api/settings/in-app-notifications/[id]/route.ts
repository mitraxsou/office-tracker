import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dismissInAppNotification } from "@/lib/in-app-notifications";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const dismissed = await dismissInAppNotification(user.id, id);
  if (!dismissed) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
