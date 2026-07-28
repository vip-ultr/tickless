export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/instagram", label: "Instagram" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
] as const;

export const FOOTER_LEGAL = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/copyright", label: "Copyright" },
] as const;
