import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/app-config";
import { getUserPresenceTimeline } from "@/lib/presence-timeline";

/** Signed-in user's own Wi-Fi and sync timeline. Does not accept another user id. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = new URL(request.url).searchParams;
  const dayKey = search.get("date");
  const daysParam = Number.parseInt(search.get("days") ?? "7", 10);
  const days = Number.isFinite(daysParam) ? daysParam : 7;

  const config = await getAppConfig();
  const timeline = await getUserPresenceTimeline(
    user.id,
    days,
    user.timezone,
    config.officeSsids,
    { dayKey },
  );

  return NextResponse.json(timeline);
}
