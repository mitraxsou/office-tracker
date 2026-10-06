import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AuditLogTable } from "@/components/AuditLogTable";
import { AuditSearchForm, auditPageHref } from "@/components/AuditSearchForm";
import { requireAdmin } from "@/lib/admin";
import { resolveAuditTimezone } from "@/lib/audit-actions";
import { searchAuditLogs, type AuditSearchInput } from "@/lib/audit-search";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchInput & { tz?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  await enforceTermsAcceptanceIfRequired(admin, "/admin/audit");
  const params = await searchParams;
  const timezone = resolveAuditTimezone(params.tz, admin.timezone);
  const result = await searchAuditLogs(params);
  const hrefFilters = { ...result.filters, tz: timezone };

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="page-hero">
          <h1 className="text-2xl font-semibold">Audit</h1>
          <p className="mt-1 text-sm text-muted">
            Search admin and system actions across global and per-user changes. Timestamps default
            to your profile timezone ({admin.timezone}).
          </p>
        </header>
        <AdminSubNav active="audit" />
        <AuditSearchForm filters={result.filters} timezone={timezone} />
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-medium">How to read this log</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
            <li>
              <strong>Actor</strong> is who the system stored as the sender of the event. For
              Teams/email alerts, actor and target are often the same person.
            </li>
            <li>
              <strong>Target</strong> is whose account was affected. Global setting means no user
              (for example config update).
            </li>
            <li>
              <strong>Details</strong> holds extra JSON. For integration_alert, type is hours_met,
              hours_started, monthly_snapshot, ooo_cleared, stale, absent, behind, or custom.
            </li>
            <li>
              This is not office presence. Use Visits and Wi-Fi and sync on the user report for
              hours.
            </li>
          </ul>
          <p className="mt-3">
            Full SOP:{" "}
            <a href="/admin/guide#audit" className="text-accent hover:underline">
              Admin guide, Audit log
            </a>
            {" · "}
            <a href="/admin/guide#audit-actions" className="text-accent hover:underline">
              What each action means
            </a>
          </p>
        </details>
        <AuditLogTable rows={result.rows} timezone={timezone} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {result.total} entries, page {result.filters.page} of {result.pageCount}
          </span>
          <div className="flex gap-2">
            {result.filters.page > 1 && (
              <a
                href={auditPageHref(hrefFilters, result.filters.page - 1)}
                className="btn-secondary px-3 py-1.5"
              >
                Previous
              </a>
            )}
            {result.filters.page < result.pageCount && (
              <a
                href={auditPageHref(hrefFilters, result.filters.page + 1)}
                className="btn-secondary px-3 py-1.5"
              >
                Next
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
