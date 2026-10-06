import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  TOKEN_REGEN_NEEDS_APPROVAL,
  canImmediateAgentTokenReissue,
} from "@/lib/agent-token-regenerate-requests";

/** Refreshing install commands revokes the current token. Settings must request approval. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canImmediateAgentTokenReissue(user)) {
    return NextResponse.json(
      { error: TOKEN_REGEN_NEEDS_APPROVAL, code: "approval_required" },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { error: TOKEN_REGEN_NEEDS_APPROVAL, code: "approval_required" },
    { status: 403 },
  );
}
