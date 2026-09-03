import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getAgentVersion } from "@/lib/agent-version";
import { isDeviceAgentVersionStale } from "@/lib/agent-update";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expectedVersion = getAgentVersion();
  const devices = await prisma.agentDevice.findMany({
    where: { uninstalledAt: null },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: [{ user: { email: "asc" } }, { serialNumber: "asc" }],
  });

  const users = new Map<
    string,
    {
      userId: string;
      email: string;
      name: string | null;
      devices: Array<{
        deviceId: string;
        serialNumber: string;
        installedVersion: string | null;
        expectedVersion: string;
        lastSeenAt: string | null;
        status: "unknown" | "needs_update";
        updateQueued: boolean;
      }>;
    }
  >();

  for (const device of devices) {
    if (!isDeviceAgentVersionStale(device.agentScriptVersion, expectedVersion)) continue;

    const row = users.get(device.userId) ?? {
      userId: device.user.id,
      email: device.user.email,
      name: device.user.name,
      devices: [],
    };
    row.devices.push({
      deviceId: device.id,
      serialNumber: device.serialNumber,
      installedVersion: device.agentScriptVersion,
      expectedVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      status: device.agentScriptVersion ? "needs_update" : "unknown",
      updateQueued: device.forceAgentUpdate,
    });
    users.set(device.userId, row);
  }

  const rows = [...users.values()];
  return NextResponse.json({
    expectedVersion,
    deviceCount: rows.reduce((sum, user) => sum + user.devices.length, 0),
    userCount: rows.length,
    users: rows,
  });
}
