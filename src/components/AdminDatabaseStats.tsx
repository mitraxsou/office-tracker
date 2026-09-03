import type { DbStats } from "@/lib/db-stats";
import { formatBytes } from "@/lib/db-stats";

export function AdminDatabaseStats({ stats }: { stats: DbStats }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium">Database usage</h2>
      <p className="mt-1 text-sm text-muted">
        {stats.provider === "postgresql"
          ? "Neon storage is plan-based. This shows current database size and the hottest operational tables, not plan capacity or disk free space."
          : "This shows the local database file size when available and current operational row counts."}
      </p>
      <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
        <span className="text-xs uppercase tracking-wide text-muted">Database size</span>
        <p className="text-2xl font-semibold">{formatBytes(stats.databaseBytes)}</p>
        {!stats.sizeAvailable && (
          <p className="text-xs text-muted">Size functions are unavailable for this connection. Row counts are still shown.</p>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted"><tr><th className="pb-2">Table</th><th className="pb-2">Rows</th><th className="pb-2">Approx. size</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {stats.rows.map((row) => (
              <tr key={row.table}>
                <td className="py-2 font-mono text-xs">{row.table}</td>
                <td className="py-2">{row.rowCount.toLocaleString("en-IN")}</td>
                <td className="py-2 text-muted">{formatBytes(row.sizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">
        Use Data maintenance below to preview and purge eligible historical rows.
      </p>
    </section>
  );
}
