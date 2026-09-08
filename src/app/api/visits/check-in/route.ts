import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkInOffice } from "@/lib/heartbeat-service";
import { handleOfficePresenceDetected } from "@/lib/ooo-presence";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await checkInOffice(user.id);
  await handleOfficePresenceDetected(user.id, user.timezone);
  return NextResponse.json({ visit, inOffice: true });
}
