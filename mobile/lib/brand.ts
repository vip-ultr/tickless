// Brand tokens. Locked: same as web (docs/mobile-app-plan.md section 7).
// No gradients. Green is primary, blue is accent only.
export const BRAND = {
  midnight: "#0B0F14",
  midnightElevated: "#11161D",
  glassBorder: "rgba(255,255,255,0.10)",
  glassTint: "rgba(255,255,255,0.04)",
  glassTintStrong: "rgba(255,255,255,0.06)",
  green: "#A7E954",
  greenDim: "rgba(167,233,84,0.14)",
  greenText: "#0B0F14", // text on green buttons
  blue: "#1FD3E8",
  white: "#F4F7F2",
  muted: "#8B95A1",
  danger: "#FF6B6B",
  dangerTint: "rgba(255,107,107,0.08)",
} as const;

// Type scale (device font size respected via allowFontScaling default true;
// sizes are base points that scale with the OS setting)
export const TYPE = {
  hero: 40,
  h1: 28,
  h2: 20,
  body: 16,
  small: 13,
} as const;

export const SPACING = {
  screen: 24,
  cardPadding: 18,
  section: 28,
} as const;

export const RADIUS = { panel: 28, button: 18, input: 18 } as const;
