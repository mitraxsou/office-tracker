import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  cancelTimezoneChangeRequest,
  createTimezoneChangeRequest,
  getUserTimezoneRequestState,
} from "@/lib/timezone-requests";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getUserTimezoneRequestState(user.id);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { requestedTimezone?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.requestedTimezone) {
    return NextResponse.json({ error: "requestedTimezone required" }, { status: 400 });
  }

  const result = await createTimezoneChangeRequest({
    userId: user.id,
    currentTimezone: user.timezone,
    requestedTimezone: body.requestedTimezone,
    message: body.message,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const result = await cancelTimezoneChangeRequest(user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
