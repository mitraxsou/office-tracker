import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  getAppConfig,
  promoteAgentCanaryToEveryone,
  updateAppConfig,
} from "@/lib/app-config";
import {
  isValidAgentVersionString,
  normalizeAgentRolloutAllowlist,
  normalizeAgentRolloutMode,
} from "@/lib/agent-rollout";
import { getAgentVersion } from "@/lib/agent-version";
import { logAuditEvent } from "@/lib/audit-log";
import { snapshotFleetStableAgentRelease } from "@/lib/agent-release-artifacts";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getAppConfig();
  const repoVersion = getAgentVersion();
  return NextResponse.json({
    repoVersion,
    agentRolloutMode: config.agentRolloutMode,
    agentFleetStableVersion: config.agentFleetStableVersion,
    agentCanaryVersion: repoVersion,
    agentRolloutAllowlistEmails: config.agentRolloutAllowlistEmails,
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    agentRolloutMode?: string;
    agentFleetStableVersion?: string;
    agentCanaryVersion?: string;
    agentRolloutAllowlistEmails?: string[];
    promoteToEveryone?: boolean;
    confirmPromote?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.promoteToEveryone === true) {
    if (body.confirmPromote !== true) {
      return NextResponse.json(
        {
          error:
            "Promote requires confirmPromote: true. This makes the canary version the fleet target for everyone.",
        },
        { status: 400 },
      );
    }

    const canary = getAgentVersion().trim();
    try {
      await snapshotFleetStableAgentRelease(canary);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not snapshot fleet-stable agent release",
        },
        { status: 409 },
      );
    }

    const config = await promoteAgentCanaryToEveryone();
    await logAuditEvent({
      actorId: admin.id,
      action: "agent_rollout_promote_everyone",
      details: {
        agentFleetStableVersion: config.agentFleetStableVersion,
        agentCanaryVersion: canary,
        agentRolloutMode: config.agentRolloutMode,
      },
    });

    return NextResponse.json({
      ok: true,
      promoted: true,
      repoVersion: canary,
      agentRolloutMode: config.agentRolloutMode,
      agentFleetStableVersion: config.agentFleetStableVersion,
      agentCanaryVersion: canary,
      agentRolloutAllowlistEmails: config.agentRolloutAllowlistEmails,
    });
  }

  const update: Parameters<typeof updateAppConfig>[0] = {};

  if (body.agentRolloutMode !== undefined) {
    if (body.agentRolloutMode !== "allowlist" && body.agentRolloutMode !== "everyone") {
      return NextResponse.json(
        { error: "agentRolloutMode must be allowlist or everyone" },
        { status: 400 },
      );
    }
    update.agentRolloutMode = normalizeAgentRolloutMode(body.agentRolloutMode);
  }

  if (body.agentFleetStableVersion !== undefined) {
    if (
      typeof body.agentFleetStableVersion !== "string" ||
      !isValidAgentVersionString(body.agentFleetStableVersion)
    ) {
      return NextResponse.json({ error: "Invalid agentFleetStableVersion" }, { status: 400 });
    }
    update.agentFleetStableVersion = body.agentFleetStableVersion.trim();
  }

  // Canary always tracks the deploy-tree version; ignore manual agentCanaryVersion.

  if (body.agentRolloutAllowlistEmails !== undefined) {
    if (!Array.isArray(body.agentRolloutAllowlistEmails)) {
      return NextResponse.json({ error: "Invalid agentRolloutAllowlistEmails" }, { status: 400 });
    }
    update.agentRolloutAllowlistEmails = normalizeAgentRolloutAllowlist(
      body.agentRolloutAllowlistEmails,
    );
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No rollout fields to update" }, { status: 400 });
  }

  const config = await updateAppConfig(update);
  await logAuditEvent({
    actorId: admin.id,
    action: "agent_rollout_update",
    details: update as Record<string, unknown>,
  });

  const repoVersion = getAgentVersion();
  return NextResponse.json({
    ok: true,
    repoVersion,
    agentRolloutMode: config.agentRolloutMode,
    agentFleetStableVersion: config.agentFleetStableVersion,
    agentCanaryVersion: repoVersion,
    agentRolloutAllowlistEmails: config.agentRolloutAllowlistEmails,
  });
}
