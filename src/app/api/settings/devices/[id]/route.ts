import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** Users must submit a removal request — admins approve in Admin → Corrections. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error:
        "Direct removal is disabled. Submit a removal request from Settings and an admin will review it.",
    },
    { status: 403 },
  );
}
