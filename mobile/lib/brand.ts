// Brand tokens. Locked: same as web (docs/mobile-app-plan.md section 7).
// No gradients. Green is primary, blue is accent only.
export const BRAND = {
  midnight: "#0B0F14",
  midnightElevated: "#11161D",
  glassBorder: "rgba(255,255,255,0.10)",
  glassTint: "rgba(255,255,255,0.04)",
  green: "#A7E954",
  greenText: "#0B0F14", // text on green buttons
  blue: "#1FD3E8",
  white: "#F4F7F2",
  muted: "#8B95A1",
  danger: "#FF6B6B",
} as const;

export const API_URL = "https://tickless.onrender.com";
// API key decision locked 2026-08-23: embed directly, same as web
// NEXT_PUBLIC_API_KEY (docs/mobile-app-plan.md decision 9).
// Value is injected at build time via app.json extra (expo-constants),
// never hardcoded here.
