import { NextResponse } from "next/server";
import { clearLoginAttempts, createSession } from "@/lib/auth";
import { verifyLoginOtp } from "@/lib/otp-auth";
import { setInstallToken, setWelcomeToken } from "@/lib/welcome-token";
import { prisma } from "@/lib/db";
import { isBreakglassEmail } from "@/lib/breakglass";

export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  const code = body.code?.trim();
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const result = await verifyLoginOtp(email, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await clearLoginAttempts();
  await createSession(result.userId);

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { mustChangePassword: true, email: true },
  });

  if (result.isNewUser && result.plainAgentToken) {
    await setWelcomeToken(result.plainAgentToken);
    await setInstallToken(result.plainAgentToken);
    return NextResponse.json({
      ok: true,
      redirectTo: "/settings?welcome=1",
      isNewUser: true,
    });
  }

  if (user?.mustChangePassword && !isBreakglassEmail(user.email)) {
    return NextResponse.json({
      ok: true,
      redirectTo: "/settings?mustChange=1",
      isNewUser: false,
    });
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/dashboard",
    isNewUser: false,
  });
}
