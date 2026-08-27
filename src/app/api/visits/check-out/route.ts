import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkOutOffice } from "@/lib/heartbeat-service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await checkOutOffice(user.id);
  if (!visit) {
    return NextResponse.json({ error: "No open visit to check out" }, { status: 400 });
  }

  return NextResponse.json({ visit, inOffice: false });
}
