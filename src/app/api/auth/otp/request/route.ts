import { NextResponse } from "next/server";
import {
  checkOtpRequestRateLimits,
  getClientIp,
  recordOtpRequestRateLimits,
} from "@/lib/auth-rate-limit";
import { isPwcEmail, sendLoginOtp } from "@/lib/otp-auth";
import { normalizeProfileEmail } from "@/lib/profile-change-requests";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: { email?: string; resend?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400, headers: NO_STORE });
  }

  const normalized = normalizeProfileEmail(email);
  if (!isPwcEmail(normalized)) {
    return NextResponse.json({ error: "Use your PwC email address" }, { status: 400, headers: NO_STORE });
  }

  const ip = getClientIp(request);
  const isResend = body.resend === true;
  const rateCheck = await checkOtpRequestRateLimits(normalized, ip, isResend);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: rateCheck.error, retryAfterSeconds: rateCheck.retryAfterSeconds },
      { status: 429, headers: NO_STORE },
    );
  }

  const result = await sendLoginOtp(normalized);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400, headers: NO_STORE },
    );
  }

  if (result.sent) {
    await recordOtpRequestRateLimits(normalized, ip);
  }

  return NextResponse.json(
    {
      ok: true,
      sent: result.sent,
      message: result.sent
        ? "If this email is registered, check Microsoft Teams for your sign-in code."
        : undefined,
    },
    { headers: NO_STORE },
  );
}
