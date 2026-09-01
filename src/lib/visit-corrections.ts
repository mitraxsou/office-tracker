export type VisitSnapshot = {
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

export type CorrectionSummary = {
  visitId?: string;
  before?: VisitSnapshot;
  after?: VisitSnapshot;
};

export type CorrectionRequestStatus = "open" | "resolved" | "closed";

export function isValidCorrectionStatus(status: string): status is CorrectionRequestStatus {
  return status === "open" || status === "resolved" || status === "closed";
}

export function visitToSnapshot(visit: {
  startAt: Date;
  endAt: Date | null;
  source: string;
  ssid: string | null;
}): VisitSnapshot {
  return {
    startAt: visit.startAt.toISOString(),
    endAt: visit.endAt?.toISOString() ?? null,
    source: visit.source,
    ssid: visit.ssid,
  };
}

export function parseVisitSnapshot(raw: string | null | undefined): VisitSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VisitSnapshot;
    if (typeof parsed.startAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCorrectionSummary(raw: string | null | undefined): CorrectionSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CorrectionSummary;
  } catch {
    return null;
  }
}

export function buildCorrectionSummary(params: {
  visitId?: string | null;
  before?: VisitSnapshot | null;
  after?: VisitSnapshot | null;
}): CorrectionSummary | null {
  if (!params.before && !params.after) return null;
  return {
    visitId: params.visitId ?? undefined,
    before: params.before ?? undefined,
    after: params.after ?? undefined,
  };
}

export function snapshotsDiffer(before: VisitSnapshot, after: VisitSnapshot): boolean {
  return (
    before.startAt !== after.startAt ||
    before.endAt !== after.endAt ||
    before.source !== after.source ||
    before.ssid !== after.ssid
  );
}

export function formatSnapshotTime(iso: string | null, timezone = "Asia/Kolkata"): string {
  if (!iso) return "open";
  return new Date(iso).toLocaleString("en-IN", { timeZone: timezone });
}

export function formatCorrectionChange(
  summary: CorrectionSummary,
  timezone = "Asia/Kolkata",
): string[] {
  const lines: string[] = [];
  if (!summary.before || !summary.after) return lines;

  if (summary.before.startAt !== summary.after.startAt) {
    lines.push(
      `Start: ${formatSnapshotTime(summary.before.startAt, timezone)} → ${formatSnapshotTime(summary.after.startAt, timezone)}`,
    );
  }
  if (summary.before.endAt !== summary.after.endAt) {
    lines.push(
      `End: ${formatSnapshotTime(summary.before.endAt, timezone)} → ${formatSnapshotTime(summary.after.endAt, timezone)}`,
    );
  }
  if (summary.before.source !== summary.after.source) {
    lines.push(`Source: ${summary.before.source} → ${summary.after.source}`);
  }
  if (summary.before.ssid !== summary.after.ssid) {
    lines.push(
      `SSID: ${summary.before.ssid ?? "none"} → ${summary.after.ssid ?? "none"}`,
    );
  }
  return lines;
}

export function serializeThreadMessage(msg: {
  id: string;
  authorRole: string;
  body: string;
  createdAt: Date;
  author: { email: string; name: string | null };
}) {
  return {
    id: msg.id,
    authorRole: msg.authorRole,
    body: msg.body,
    createdAt: msg.createdAt.toISOString(),
    authorEmail: msg.author.email,
    authorName: msg.author.name,
  };
}
