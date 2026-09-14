type OfficePulseLogoProps = {
  className?: string;
};

/**
 * Decorative brand mark (pulse waveform). Parent link keeps the visible text label.
 */
export function OfficePulseLogo({ className }: OfficePulseLogoProps) {
  return (
    <span
      className={`office-pulse-logo relative inline-flex h-6 w-6 shrink-0 text-[var(--pwc-orange)] md:h-7 md:w-7 ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="6"
          fill="var(--background-elevated)"
          stroke="var(--border)"
          strokeWidth="1"
        />
        <circle
          className="office-pulse-logo__ring"
          cx="16"
          cy="16"
          r="11"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
        <path
          className="office-pulse-logo__wave"
          d="M2 16 H8 L10 10 L12 22 L14 8 L16 24 L18 14 L20 18 L24 16 H30"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
