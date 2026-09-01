import { NextResponse } from "next/server";
import { authenticateAgentToken } from "@/lib/agent-auth";
import { recordAgentUninstall } from "@/lib/agent-lifecycle";
import { prisma } from "@/lib/db";
import {
  checkRateLimit,
  extractBearerToken,
  extractTokenFromBody,
  sanitizeSerialNumber,
} from "@/lib/security";

const ALLOWED_EVENTS = new Set(["uninstall"]);

function sanitizeHostname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 128);
  return trimmed || null;
}

function sanitizeScriptVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 32);
  return trimmed || null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = extractBearerToken(request) ?? extractTokenFromBody(body);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const serialNumber = sanitizeSerialNumber(body.serialNumber);
  if (!serialNumber) {
    return NextResponse.json({ error: "serialNumber is required" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event.trim() : "";
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  }

  if (!checkRateLimit(`lifecycle:${token.slice(0, 8)}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await authenticateAgentToken(token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const metadata: Record<string, unknown> = {
    tokenPrefix: auth.agentToken.tokenPrefix,
  };
  const hostname = sanitizeHostname(body.hostname);
  if (hostname) metadata.hostname = hostname;
  const scriptVersion = sanitizeScriptVersion(body.scriptVersion);
  if (scriptVersion) metadata.scriptVersion = scriptVersion;

  const existingDevice = await prisma.agentDevice.findUnique({
    where: { userId_serialNumber: { userId: auth.userId, serialNumber } },
    select: { id: true },
  });

  await recordAgentUninstall({
    userId: auth.userId,
    deviceId: existingDevice?.id ?? null,
    serialNumber,
    source: "agent_script",
    metadata,
  });

  return NextResponse.json({ ok: true, event: "uninstall" });
}
