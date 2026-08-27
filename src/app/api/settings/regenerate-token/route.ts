import { NextResponse } from "next/server";

/** Self-service token regeneration is disabled; admins issue tokens per laptop. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Token generation is admin-only. Ask your admin for a laptop install token, or use a pending token in Settings.",
    },
    { status: 403 },
  );
}
