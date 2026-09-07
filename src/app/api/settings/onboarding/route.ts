import { NextResponse } from "next/server";
import { canSetInitialPassword, getCurrentUser, setInitialUserPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; password?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (password || confirmPassword) {
    if (!password || !confirmPassword) {
      return NextResponse.json({ error: "Enter and confirm your password" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }
    if (!canSetInitialPassword(user)) {
      return NextResponse.json(
        { error: "Use change password to update your password" },
        { status: 400 },
      );
    }
    try {
      await setInitialUserPassword(user.id, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not set password";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (name && name !== (user.name ?? "")) {
    if (user.registrationSource !== "otp_self") {
      return NextResponse.json(
        { error: "Name changes require admin approval after onboarding" },
        { status: 400 },
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  return NextResponse.json({ ok: true });
}
