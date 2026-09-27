export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Public contact used by the legal pages (Terms, Privacy, DMCA).
// Replace with a real monitored inbox before launch.
export const CONTACT_EMAIL = "legal@tickless.app";

// Sales/advertising inbox, surfaced on /advertise. Kept separate from the
// legal address above so a paid enquiry never lands in a takedown queue.
// BLOCKER: this mailbox must actually exist (and tickless.app must have an MX
// record) before /advertise is announced -- sitemap.ts still publishes
// tickless.vercel.app as the canonical host, so confirm the domain first.
export const ADS_EMAIL = "ads@tickless.app";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
] as const;

export const FOOTER_LEGAL = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/copyright", label: "Copyright" },
  { href: "/dmca", label: "DMCA" },
] as const;
