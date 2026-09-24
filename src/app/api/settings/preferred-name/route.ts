import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_PREFERRED_NAME_LENGTH = 32;
const PREFERRED_NAME_PATTERN = /^[A-Za-z][A-Za-z\s'-]*$/;

/**
 * Normalize a greeting-only display name.
 * Empty / whitespace clears preferredName (falls back to legal name).
 * Returns null when cleared, or the trimmed value when valid.
 */
export function normalizePreferredName(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new Error("preferredName must be a string");
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_PREFERRED_NAME_LENGTH) {
    throw new Error(`preferredName must be ${MAX_PREFERRED_NAME_LENGTH} characters or fewer`);
  }
  if (!PREFERRED_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      "preferredName may only use letters, spaces, apostrophes, and hyphens",
    );
  }
  return trimmed;
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { preferredName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!("preferredName" in body)) {
    return NextResponse.json({ error: "preferredName is required" }, { status: 400 });
  }

  let preferredName: string | null;
  try {
    preferredName = normalizePreferredName(body.preferredName);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid preferredName";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { preferredName },
    select: { preferredName: true },
  });

  return NextResponse.json({ preferredName: updated.preferredName });
}
