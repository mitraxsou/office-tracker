import { NextResponse } from "next/server";
import { submitAccountAccessRequest } from "@/lib/account-access-requests";
import {
  checkAccountRequestRateLimit,
  getClientIp,
  recordAccountRequestRateLimit,
} from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  let body: { email?: string; name?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "");
  const ip = getClientIp(request);
  const rate = await checkAccountRequestRateLimit(email, ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.error ?? "Rate limit exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429 },
    );
  }

  await recordAccountRequestRateLimit(email, ip);

  const result = await submitAccountAccessRequest({
    email,
    name: body.name,
    message: body.message,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "If you need access, your request was recorded. An admin will review it. If you already have an account, sign in with OTP.",
  });
}
