"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, Home, CircleHelp, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Wordmark } from "./Wordmark";

const SHEET_LINKS = [
  { href: "/", label: "Home", desc: "Paste a link, get the clean video", icon: Home },
  { href: "/faq", label: "FAQ", desc: "Questions, answered", icon: CircleHelp },
  { href: "/about", label: "About", desc: "What Tickless is and who builds it", icon: Info },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  // Close on Escape and on browser Back (history), lock scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    window.history.pushState({ sheet: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <nav className="glass-strong mx-auto flex max-w-5xl items-center justify-between rounded-2xl px-5 py-3">
        <Wordmark className="text-xl" />

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {SHEET_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm tx-muted transition-colors hover:tx"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/"
            className="btn-brand rounded-full px-4 py-2 text-sm font-semibold"
          >
            Paste a link
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="md:hidden tx"
        >
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="glass-strong fixed inset-x-0 bottom-0 z-50 rounded-t-3xl px-5 pb-10 pt-3 md:hidden"
              style={{ height: "52vh" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => info.offset.y > 120 && setOpen(false)}
            >
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--glass-border)]" />
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider tx-muted">
                  Menu
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="glass flex h-8 w-8 items-center justify-center rounded-full"
                >
                  <X size={16} className="tx-muted" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {SHEET_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="glass flex items-center gap-4 rounded-2xl px-4 py-4 active:scale-[0.98]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.78_0.16_195_/_0.15)]">
                      <l.icon size={18} className="tx-accent" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{l.label}</span>
                      <span className="block truncate text-xs tx-muted">
                        {l.desc}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>

              <p className="mt-6 px-1 text-center text-xs tx-muted">
                Tickless by Optivis Labs
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
