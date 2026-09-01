import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getTodaySummary } from "@/lib/heartbeat-service";
import { getUserHoursTarget } from "@/lib/app-config";
import {
  createUserByAdmin,
  issueAgentToken,
  summarizeAgentTokens,
} from "@/lib/auth";
import { revokeExpiredPendingTokens } from "@/lib/token-expiry";
import { logAuditEvent } from "@/lib/audit-log";
import { buildInstallCommand } from "@/lib/agent-branding";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await revokeExpiredPendingTokens();

  const users = await prisma.user.findMany({
    include: {
      agentDevices: { orderBy: { lastSeenAt: "desc" } },
      agentTokens: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
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
        tokens: summarizeAgentTokens(user.agentTokens),
        today: {
          totalHours: summary.totalHours,
          metTarget: summary.metTarget,
          agentHealthy: summary.agentHealthy,
          inOfficeNow: summary.inOfficeNow,
          lastHeartbeat: summary.lastHeartbeat?.recordedAt ?? null,
        },
      };
    }),
  );

  return NextResponse.json({ users: summaries });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; password?: string; name?: string; issueToken?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password?.trim();
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "email and password (min 8 chars) are required" },
      { status: 400 },
    );
  }

  try {
    const { user, plainAgentToken } = await createUserByAdmin({
      email,
      password,
      name: body.name,
      issueToken: body.issueToken !== false,
      issuedById: admin.id,
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "user_create",
      targetUserId: user.id,
      details: { email: user.email },
    });

    if (plainAgentToken) {
      await logAuditEvent({
        actorId: admin.id,
        action: "agent_token_issue",
        targetUserId: user.id,
        details: { label: "Initial laptop" },
      });
    }

    const installCommand = plainAgentToken
      ? buildInstallCommand(appUrl(), plainAgentToken)
      : null;

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: plainAgentToken,
      installCommand,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
