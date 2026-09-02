import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getTodaySummary } from "@/lib/heartbeat-service";
import { getUserHoursTarget } from "@/lib/app-config";
import {
  createUserByAdmin,
  summarizeAgentTokens,
} from "@/lib/auth";
import { revokeExpiredPendingTokens } from "@/lib/token-expiry";
import { logAuditEvent } from "@/lib/audit-log";
import { buildInstallCommand } from "@/lib/agent-branding";
import { getAgentVersion } from "@/lib/agent-version";
import { isDeviceAgentVersionStale } from "@/lib/agent-update";
import {
  buildUserSearchWhere,
  parseAdminUsersListParams,
} from "@/lib/admin-users";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

async function summarizeUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  timezone: string;
  hoursTarget: number | null;
  agentDevices: Array<{
    id: string;
    serialNumber: string;
    lastSeenAt: Date | null;
    agentScriptVersion: string | null;
    agentVersionReportedAt: Date | null;
    forceAgentUpdate: boolean;
  }>;
  agentTokens: Parameters<typeof summarizeAgentTokens>[0];
}) {
  const serverAgentVersion = getAgentVersion();
  const hoursTarget = await getUserHoursTarget(user);
  const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    timezone: user.timezone,
    hoursTarget,
    devices: user.agentDevices.map((d) => ({
      id: d.id,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt,
      agentScriptVersion: d.agentScriptVersion,
      agentVersionReportedAt: d.agentVersionReportedAt,
      forceAgentUpdate: d.forceAgentUpdate,
      agentVersionStale: isDeviceAgentVersionStale(d.agentScriptVersion, serverAgentVersion),
    })),
    serverAgentVersion,
    tokens: summarizeAgentTokens(user.agentTokens),
    today: {
      totalHours: summary.totalHours,
      metTarget: summary.metTarget,
      agentHealthy: summary.agentHealthy,
      inOfficeNow: summary.inOfficeNow,
      lastHeartbeat: summary.lastHeartbeat?.recordedAt ?? null,
    },
  };
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await revokeExpiredPendingTokens();

  const { searchParams } = new URL(request.url);
  const { all, search, page, pageSize } = parseAdminUsersListParams(searchParams);
  const where = buildUserSearchWhere(search);

  const userQuery = {
    where,
    include: {
      agentDevices: { orderBy: { lastSeenAt: "desc" as const } },
      agentTokens: { where: { revokedAt: null }, orderBy: { createdAt: "desc" as const } },
    },
    orderBy: { email: "asc" as const },
  };

  if (all) {
    const users = await prisma.user.findMany(userQuery);
    const summaries = await Promise.all(users.map((user) => summarizeUser(user)));
    return NextResponse.json({
      users: summaries,
      total: summaries.length,
      page: 1,
      pageSize: summaries.length,
    });
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      ...userQuery,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const summaries = await Promise.all(users.map((user) => summarizeUser(user)));

  return NextResponse.json({
    users: summaries,
    total,
    page,
    pageSize,
  });
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
