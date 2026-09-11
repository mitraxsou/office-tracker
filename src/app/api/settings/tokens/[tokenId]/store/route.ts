import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getUserInstallTokenState,
  persistPendingTokenEnc,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractTokenFromBody } from "@/lib/security";

type RouteContext = { params: Promise<{ tokenId: string }> };

/** Save encrypted copy of an existing agent token (e.g. pasted from config.json) for Settings display. */
export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tokenId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plainToken = extractTokenFromBody(body);
  if (!plainToken) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const row = await prisma.agentToken.findFirst({
    where: { id: tokenId, userId: user.id, revokedAt: null },
  });
  if (!row) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (plainToken.slice(0, 8) !== row.tokenPrefix) {
    return NextResponse.json(
      { error: "Token does not match this laptop (wrong prefix)." },
      { status: 400 },
    );
  }

  const ok = await persistPendingTokenEnc(user.id, plainToken);
  if (!ok) {
    return NextResponse.json({ error: "Could not save token" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const state = await getUserInstallTokenState(user.id, appUrl);
  const entry = state.installTokens.find((t) => t.id === tokenId);

  return NextResponse.json({
    ok: true,
    installToken: entry ?? null,
  });
}
