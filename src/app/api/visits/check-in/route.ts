import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkInOffice } from "@/lib/heartbeat-service";
import { handleOfficePresenceDetected } from "@/lib/ooo-presence";
import { createManualVisitRequest } from "@/lib/manual-visit-requests";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "admin") {
    const visit = await checkInOffice(user.id);
    await handleOfficePresenceDetected(user.id, user.timezone);
    return NextResponse.json({ visit, inOffice: true });
  }

  const result = await createManualVisitRequest({
    userId: user.id,
    startAt: new Date(),
    ssid: "Manual check-in",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      request: result.request,
      inOffice: false,
      pendingApproval: true,
    },
    { status: 201 },
  );
}
