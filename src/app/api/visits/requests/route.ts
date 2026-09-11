import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getUserManualVisitRequestState } from "@/lib/manual-visit-requests";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getUserManualVisitRequestState(userId);
  return NextResponse.json(state);
}
