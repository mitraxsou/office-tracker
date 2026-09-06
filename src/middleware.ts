import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_BODY_MAX_BYTES = 1024;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth/otp")) {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > AUTH_BODY_MAX_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const requestId = crypto.randomUUID();
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/otp/:path*"],
};
