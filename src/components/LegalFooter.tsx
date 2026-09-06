import Link from "next/link";

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-muted ${className ?? ""}`}>
      <p>
        Hobby project, not official PwC tooling.{" "}
        <Link href="/terms" className="text-accent hover:underline">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/help" className="text-accent hover:underline">
          Help
        </Link>
      </p>
    </footer>
  );
}
