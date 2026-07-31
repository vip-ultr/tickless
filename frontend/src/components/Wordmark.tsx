import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-sans font-extrabold tracking-tight select-none ${className}`}
    >
      <span className="tx">Tick</span>
      <span className="tx-brand">less</span>
    </Link>
  );
}
