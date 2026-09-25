import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { requireAdmin } from "@/lib/admin";
import { searchAuditLogs, type AuditSearchInput } from "@/lib/audit-search";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";

function pageHref(filters: AuditSearchInput, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value) params.set(key, String(value));
  }
  return `/admin/audit?${params.toString()}`;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchInput>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  await enforceTermsAcceptanceIfRequired(admin, "/admin/audit");
  const result = await searchAuditLogs(await searchParams);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="page-hero">
          <h1 className="text-2xl font-semibold">Audit</h1>
          <p className="mt-1 text-sm text-muted">Search admin and system actions across global and per-user changes.</p>
        </header>
        <AdminSubNav active="audit" />
        <form className="card grid gap-3 p-4 md:grid-cols-5">
          <input name="target" defaultValue={result.filters.target} placeholder="Target user" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="actor" defaultValue={result.filters.actor} placeholder="Actor or admin" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="action" defaultValue={result.filters.action} placeholder="Action type" className="rounded-lg border px-3 py-2 text-sm" />
          <input type="date" name="from" defaultValue={result.filters.from} aria-label="From date" className="rounded-lg border px-3 py-2 text-sm" />
          <input type="date" name="to" defaultValue={result.filters.to} aria-label="To date" className="rounded-lg border px-3 py-2 text-sm" />
          <div className="flex gap-2 md:col-span-5">
            <button type="submit" className="btn-primary px-4 py-2 text-sm">Search</button>
            <Link href="/admin/audit" className="btn-secondary px-4 py-2 text-sm">Clear</Link>
          </div>
        </form>
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-muted">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target user</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap p-3">{new Date(row.timestamp).toLocaleString("en-IN")}</td>
                  <td className="p-3">{row.actor.name ?? row.actor.email}<span className="block text-xs text-muted">{row.actor.email}</span></td>
                  <td className="p-3 font-mono text-xs">{row.action}</td>
                  <td className="p-3">{row.targetUser ? row.targetUser.name ?? row.targetUser.email : <span className="text-muted">Global setting</span>}</td>
                  <td className="max-w-md p-3 text-xs text-muted">{row.detailsSummary}</td>
                </tr>
              ))}
              {result.rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">No audit entries match these filters.</td></tr>}
            </tbody>
          </table>
        </section>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{result.total} entries, page {result.filters.page} of {result.pageCount}</span>
          <div className="flex gap-2">
            {result.filters.page > 1 && <Link href={pageHref(result.filters, result.filters.page - 1)} className="btn-secondary px-3 py-1.5">Previous</Link>}
            {result.filters.page < result.pageCount && <Link href={pageHref(result.filters, result.filters.page + 1)} className="btn-secondary px-3 py-1.5">Next</Link>}
          </div>
        </div>
      </main>
    </>
  );
}
