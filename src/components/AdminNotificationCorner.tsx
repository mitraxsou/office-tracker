import Link from "next/link";
import type { AdminInboxItem } from "@/lib/admin-inbox";

export function AdminNotificationCorner({
  total,
  items,
  placement = "header",
}: {
  total: number;
  items: AdminInboxItem[];
  placement?: "header" | "drawer";
}) {
  const inDrawer = placement === "drawer";

  return (
    <details className={inDrawer ? "w-full min-w-0" : "relative"}>
      <summary
        className={`relative cursor-pointer list-none rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--border)] ${
          inDrawer
            ? "flex w-full min-h-11 items-center justify-center gap-2 px-3 py-2"
            : "px-2.5 py-1.5"
        }`}
        aria-label={`${total} open admin requests`}
        title="Admin requests"
      >
        <span aria-hidden="true">🔔</span>
        {inDrawer && <span className="text-xs">Requests{total > 0 ? ` (${total})` : ""}</span>}
        {total > 0 && (
          <span
            className={`absolute min-w-5 rounded-full bg-[var(--pwc-orange)] px-1 text-center text-xs font-semibold text-white ${
              inDrawer ? "right-2 top-1.5" : "-right-2 -top-2"
            }`}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </summary>
      <div
        className={
          inDrawer
            ? "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg"
            : "absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-3 shadow-xl"
        }
      >
        <div
          className={`mb-2 gap-2 ${inDrawer ? "flex flex-col" : "flex items-center justify-between"}`}
        >
          <p className="font-medium">Admin requests</p>
          <Link
            href="/admin/inbox"
            className={`text-xs text-accent hover:underline ${inDrawer ? "self-start" : ""}`}
          >
            Open inbox
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-muted">No open requests.</p>
        ) : (
          <ul className={`space-y-1 overflow-y-auto ${inDrawer ? "max-h-48" : "max-h-80"}`}>
            {items.slice(0, 6).map((entry) => (
              <li key={`${entry.kind}:${entry.id}`}>
                <Link
                  href={entry.href}
                  className="block rounded-lg p-2 text-sm hover:bg-[var(--border)]"
                >
                  <span className="font-medium">{entry.label}</span>
                  <span className="block truncate text-xs text-muted">
                    {entry.userName ?? entry.userEmail}: {entry.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
