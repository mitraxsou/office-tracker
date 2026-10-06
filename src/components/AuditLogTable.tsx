import Link from "next/link";
import { MetricHelp } from "@/components/MetricHelp";
import {
  auditActionGuideHref,
  describeAuditAction,
  formatAuditDetailsSummary,
  formatAuditTimestamp,
  integrationAlertTypeHelp,
} from "@/lib/audit-actions";

type AuditRow = {
  id: string;
  timestamp: string;
  action: string;
  actor: { email: string; name: string | null };
  targetUser: { email: string; name: string | null } | null;
  detailsRaw: string | null;
};

export function AuditLogTable({
  rows,
  timezone,
}: {
  rows: AuditRow[];
  timezone: string;
}) {
  return (
    <section className="card overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-b border-[var(--border)] text-muted">
          <tr>
            <th className="p-3">Timestamp ({timezone})</th>
            <th className="p-3">Actor</th>
            <th className="p-3">Action</th>
            <th className="p-3">Target user</th>
            <th className="p-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const guide = describeAuditAction(row.action);
            const details = formatAuditDetailsSummary(row.detailsRaw, timezone);
            const alertHelp = row.action === "integration_alert"
              ? integrationAlertTypeHelp(parseDetailType(row.detailsRaw))
              : null;
            return (
              <tr key={row.id}>
                <td className="whitespace-nowrap p-3">
                  {formatAuditTimestamp(row.timestamp, timezone)}
                </td>
                <td className="p-3">
                  {row.actor.name ?? row.actor.email}
                  <span className="block text-xs text-muted">{row.actor.email}</span>
                </td>
                <td className="p-3">
                  <div className="flex items-start gap-1.5">
                    <div>
                      <p className="font-medium leading-snug">{guide.label}</p>
                      <p className="font-mono text-[11px] text-muted">{row.action}</p>
                    </div>
                    <MetricHelp label={`${guide.label} help`} tooltip={guide.summary} />
                    <Link
                      href={auditActionGuideHref(row.action)}
                      className="shrink-0 text-[11px] text-accent hover:underline"
                    >
                      SOP
                    </Link>
                  </div>
                </td>
                <td className="p-3">
                  {row.targetUser ? (
                    row.targetUser.name ?? row.targetUser.email
                  ) : (
                    <span className="text-muted">Global setting</span>
                  )}
                </td>
                <td className="max-w-md p-3 text-xs text-muted">
                  {details}
                  {alertHelp && <p className="mt-1">{alertHelp}</p>}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted">
                No audit entries match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function parseDetailType(detailsRaw: string | null): unknown {
  if (!detailsRaw) return null;
  try {
    const parsed = JSON.parse(detailsRaw) as { type?: unknown };
    return parsed.type ?? null;
  } catch {
    return null;
  }
}
