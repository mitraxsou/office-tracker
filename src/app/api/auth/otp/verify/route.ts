import { NextResponse } from "next/server";
import {
  clearLoginAttempts,
  recordFailedLoginAttempt,
  setSessionCookieOnResponse,
} from "@/lib/auth";
import {
  checkOtpVerifyRateLimits,
  getClientIp,
  recordOtpVerifyRateLimit,
} from "@/lib/auth-rate-limit";
import { verifyLoginOtp } from "@/lib/otp-auth";
import { setInstallToken, setWelcomeToken } from "@/lib/welcome-token";
import { prisma } from "@/lib/db";
import { getCurrentLegalVersion } from "@/lib/legal-config";
import { getPostLoginRedirect } from "@/lib/terms-acceptance";
import { normalizeProfileEmail } from "@/lib/profile-change-requests";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const email = body.email?.trim();
  const code = body.code?.trim();
  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400, headers: NO_STORE },
    );
  }

  const normalized = normalizeProfileEmail(email);
  const ip = getClientIp(request);
  const rateCheck = await checkOtpVerifyRateLimits(normalized, ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: rateCheck.error, retryAfterSeconds: rateCheck.retryAfterSeconds },
      { status: 429, headers: NO_STORE },
    );
  }

  await recordOtpVerifyRateLimit(normalized, ip);

  const result = await verifyLoginOtp(normalized, code);
  if (!result.ok) {
    if (result.invalidCode) {
      await recordFailedLoginAttempt();
    }
    return NextResponse.json({ error: result.error }, { status: 400, headers: NO_STORE });
  }

  await clearLoginAttempts();

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: {
      mustChangePassword: true,
      email: true,
      termsAcceptedAt: true,
      termsAcceptedVersion: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 400, headers: NO_STORE });
  }

  if (result.isNewUser && result.plainAgentToken) {
    await setWelcomeToken(result.plainAgentToken);
    await setInstallToken(result.plainAgentToken);
  }

  const currentLegalVersion = await getCurrentLegalVersion();
  const redirectTo = getPostLoginRedirect(user, currentLegalVersion, { isNewUser: result.isNewUser });

  const response = NextResponse.json(
    {
      ok: true,
      redirectTo,
      isNewUser: result.isNewUser,
    },
    { headers: NO_STORE },
  );
  await setSessionCookieOnResponse(response, result.userId);
  return response;
}
