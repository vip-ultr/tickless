import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { NAV_LINKS, FOOTER_LEGAL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mx-auto mt-24 max-w-5xl px-6 pb-12">
      <div className="glass rounded-3xl px-8 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Wordmark className="text-lg" />
            <p className="mt-3 text-sm tx-muted">
              The clean way to save TikTok videos.
            </p>
          </div>
          <div className="flex gap-12">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider tx-muted">
                Product
              </span>
              {NAV_LINKS.filter((l) => l.label !== "About").map((l) => (
                <Link key={l.href} href={l.href} className="text-sm tx-muted hover:tx">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider tx-muted">
                Company
              </span>
              <Link href="/about" className="text-sm tx-muted hover:tx">
                About
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider tx-muted">
                Legal
              </span>
              {FOOTER_LEGAL.map((l) => (
                <Link key={l.href} href={l.href} className="text-sm tx-muted hover:tx">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-10 border-t border-[var(--glass-border)] pt-6 text-xs tx-muted">
          (c) 2026 Tickless by Optivis Labs. Not affiliated with TikTok or ByteDance.{" "}
          <button
            type="button"
            data-cc="show-preferencesModal"
            className="underline hover:tx"
          >
            Cookie settings
          </button>
        </p>
      </div>
    </footer>
  );
}
