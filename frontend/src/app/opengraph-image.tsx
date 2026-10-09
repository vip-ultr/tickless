import { ImageResponse } from "next/og";

// Programmatic OG image (Next file convention). Served at /opengraph-image and
// injected into <head> automatically. 1200x630 is the 1.91:1 ratio every major
// crawler renders: X summary_large_image, WhatsApp link previews, Discord
// embeds, Telegram, iMessage, Slack.
//
// Colours mirror frontend/src/app/globals.css brand tokens (LOCKED) and
// public/icon-512.png: midnight slate ground, electric lime mark, no gradients.
export const alt = "Tickless - clean, watermark-free TikTok and Instagram downloads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#14171E"; // --bg-base midnight slate
const SURFACE = "#242833"; // --bg-elevated, matches the app icon's tile
const LIME = "#A6E63D"; // --brand-primary electric lime
const FG = "#F4F6F8"; // --text-primary
const MUTED = "#9AA3B2"; // --text-muted
const CHIP = "rgba(255,255,255,0.06)";
const HAIRLINE = "rgba(255,255,255,0.14)";

const CHIP_FONT = 26;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: BG,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Dashed inset frame: the same affordance motif as the site's
            upload targets. Satori renders borderStyle dashed. */}
        <div
          style={{
            position: "absolute",
            top: 26,
            left: 26,
            right: 26,
            bottom: 26,
            border: "2px dashed rgba(255,255,255,0.10)",
            borderRadius: 36,
          }}
        />

        {/* Wordmark row: app-icon tile + Tick(white)less(lime) */}
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div
            style={{
              width: 124,
              height: 124,
              borderRadius: 32,
              backgroundColor: SURFACE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: LIME,
                fontSize: 82,
                fontWeight: 800,
                lineHeight: 1,
                marginTop: -6,
              }}
            >
              T
            </span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 86,
              fontWeight: 800,
              letterSpacing: -2,
              color: FG,
            }}
          >
            <span>Tick</span>
            <span style={{ color: LIME }}>less</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              fontSize: 46,
              fontWeight: 700,
              color: FG,
              letterSpacing: -0.5,
            }}
          >
            Clean, watermark-free downloads.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 31,
              fontWeight: 500,
              color: MUTED,
            }}
          >
            TikTok &middot; Instagram &middot; No app, no sign-up
          </div>
        </div>

        {/* Feature chips + domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {["No watermark", "HD quality", "MP3 audio", "100% free"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 24px",
                    borderRadius: 999,
                    backgroundColor: CHIP,
                    border: `1.5px solid ${HAIRLINE}`,
                    color: "#C9D0DA",
                    fontSize: CHIP_FONT,
                    fontWeight: 600,
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
              fontSize: 28,
              fontWeight: 500,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: LIME,
              }}
            />
            tickless.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
