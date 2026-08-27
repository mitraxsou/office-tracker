import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkInOffice } from "@/lib/heartbeat-service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await checkInOffice(user.id);
  return NextResponse.json({ visit, inOffice: true });
}
