import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePreferredName } from "@/lib/preferred-name";

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
