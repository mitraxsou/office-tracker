import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getRecentLifecycleEvents } from "@/lib/agent-lifecycle";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? "50")));
  const events = await getRecentLifecycleEvents(limit);

  return NextResponse.json({ events, count: events.length });
}
