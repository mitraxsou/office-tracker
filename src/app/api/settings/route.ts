import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { timezone?: string; hoursTarget?: unknown; ssids?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.hoursTarget !== undefined || body.ssids !== undefined) {
    return NextResponse.json(
      { error: "Hours target and office SSIDs are managed by admin only" },
      { status: 403 }
    );
  }

  const { timezone } = body;
  if (timezone === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Timezone changes require admin approval. Submit a request from Settings instead.",
    },
    { status: 403 },
  );
}
