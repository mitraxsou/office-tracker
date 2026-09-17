import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserAgentActivitySnapshot } from "@/lib/agent-activity-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getUserAgentActivitySnapshot(user.id, user.timezone);
  return NextResponse.json(snapshot);
}
