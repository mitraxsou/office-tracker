import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadTodaySyncRevisionForUser } from "@/lib/today-sync-revision";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const revision = await loadTodaySyncRevisionForUser(user.id, user.agentDevices);
  return NextResponse.json(
    { revision },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
