import { NextResponse } from "next/server";
import { changeUserPassword, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
  }

  try {
    await changeUserPassword(user.id, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Password change failed";
    const status =
      message === "Current password is incorrect" ||
      message.includes("Breakglass password is managed")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
