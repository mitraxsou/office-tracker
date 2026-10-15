import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { selfCorrectVisitCheckout } from "@/lib/user-visit-checkout";

/** PATCH: user self-corrects an inferred checkout time (no admin approval). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { endAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.endAt?.trim();
  if (!raw) {
    return NextResponse.json({ error: "endAt is required" }, { status: 400 });
  }
  const endAt = new Date(raw);
  if (Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "Invalid endAt" }, { status: 400 });
  }

  const result = await selfCorrectVisitCheckout({
    userId: user.id,
    visitId: id,
    endAt,
    timezone: user.timezone,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
