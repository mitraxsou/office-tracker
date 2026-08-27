import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getTodaySummary } from "@/lib/heartbeat-service";
import { getUserHoursTarget } from "@/lib/app-config";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      agentDevices: { orderBy: { lastSeenAt: "desc" } },
      agentToken: true,
    },
    orderBy: { email: "asc" },
  });

  const summaries = await Promise.all(
    users.map(async (user) => {
      const hoursTarget = await getUserHoursTarget(user);
      const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        timezone: user.timezone,
        hoursTarget,
        devices: user.agentDevices,
        today: {
          totalHours: summary.totalHours,
          metTarget: summary.metTarget,
          agentHealthy: summary.agentHealthy,
          inOfficeNow: summary.inOfficeNow,
          lastHeartbeat: summary.lastHeartbeat?.recordedAt ?? null,
        },
      };
    })
  );

  return NextResponse.json({ users: summaries });
}
