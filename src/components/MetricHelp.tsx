export function MetricHelp({
  tooltip,
  label = "More information",
}: {
  tooltip: string;
  label?: string;
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--border)] text-[9px] leading-none text-muted transition-colors hover:border-[var(--pwc-orange)] hover:text-[var(--pwc-orange)]"
        aria-label={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2.5 py-2 text-left text-[11px] leading-snug text-muted shadow-lg group-hover:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </span>
  );
}
