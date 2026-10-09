import { ImageResponse } from "next/og";
import { OG_FACES, OG_ICON_DATA } from "@/lib/og-assets";

// Programmatic OG image (Next file convention, served at /opengraph-image and
// /twitter-image). 1200x630 is the 1.91:1 ratio every major crawler renders:
// X summary_large_image, WhatsApp, Discord, Telegram, iMessage, Slack.
//
// Design mirrors the site itself rather than approximating it:
//   - Geist, the exact variable font next/font loads (bundled in og-assets.ts,
//     so the route has zero runtime fetches).
//   - public/icon-512.png, the real brand icon, not a redrawn stand-in.
//   - The homepage hero's copy and hierarchy: cyan eyebrow, extrabold
//     headline with the accent word, muted subline.
// Brand tokens (LOCKED, see globals.css): midnight ground, electric lime
// primary, luminous cyan accent, no gradients.
export const alt = "Tickless - clean, watermark-free TikTok and Instagram downloads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#14171E"; // --bg-base
const FG = "#F4F6F8"; // --text-primary
const MUTED = "#9AA3B2"; // --text-muted
const LIME = "#A6E63D"; // --brand-primary
const CYAN = "#5CC8DC"; // --brand-accent (oklch(0.78 0.16 195))
const CHIP_BG = "rgba(255,255,255,0.05)";
const HAIRLINE = "rgba(255,255,255,0.12)";

// Satori wants font bytes, not a base64 string. atob exists on both the edge
// and node runtimes, so this stays portable either way.
function decodeFont(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "76px 84px",
          backgroundColor: BG,
          fontFamily: "Geist",
          position: "relative",
        }}
      >
        {/* Dashed inset frame: the same affordance motif as the site's
            upload targets, kept faint so it frames without competing. */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: "2px dashed rgba(255,255,255,0.09)",
            borderRadius: 40,
          }}
        />

        {/* Header: brand icon + wordmark, tracking-tight like the navbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img
            src={OG_ICON_DATA}
            width={116}
            height={116}
            style={{ display: "flex" }}
            alt=""
          />
          <div
            style={{
              display: "flex",
              fontSize: 82,
              fontWeight: 800,
              letterSpacing: -3,
              color: FG,
            }}
          >
            <span>Tick</span>
            <span style={{ color: LIME }}>less</span>
          </div>
        </div>

        {/* Hero copy, same hierarchy as the homepage h1 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            marginTop: 54,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 27,
              fontWeight: 600,
              color: CYAN,
              letterSpacing: 0.2,
            }}
          >
            {/* Text wrapped in one span: Satori splits bare text nodes inside
                flex containers into per-word items with uneven spacing. */}
            <span>Free TikTok &amp; Instagram downloader</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.14,
              letterSpacing: -1.6,
              color: FG,
            }}
          >
            {/* Two plain lines, accent line on its own: Satori mangles inline
                accent spans inside flex text (drops the space before the
                nested span, adds a phantom one after it). */}
            <span style={{ display: "flex" }}>Save any video without the</span>
            <span style={{ display: "flex", color: LIME }}>watermark.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 29,
              fontWeight: 450,
              color: MUTED,
              marginTop: 6,
            }}
          >
            <span>No sign-up, no app. Clean files straight to your device.</span>
          </div>
        </div>

        {/* Footer: feature chips + domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            {["No watermark", "HD quality", "MP3 audio", "100% free"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "13px 26px",
                    borderRadius: 999,
                    backgroundColor: CHIP_BG,
                    border: `1.5px solid ${HAIRLINE}`,
                    color: "#C6CDD8",
                    fontSize: 25,
                    fontWeight: 550,
                    letterSpacing: -0.2,
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: MUTED,
              fontFamily: "Geist Mono",
              fontSize: 25,
              fontWeight: 500,
              letterSpacing: -0.3,
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                backgroundColor: LIME,
              }}
            />
            tickless.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: OG_FACES.map((f) => ({
        name: f.name,
        data: decodeFont(f.data),
        // Numeric literals: satori's Weight type is 100..900 numbers, and
        // rejects strings.
        weight: f.weight as 500 | 600 | 700 | 800,
        style: "normal",
      })),
    },
  );
}
