"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { API_URL } from "@/lib/config";

type Ad = {
  id: string;
  slot: string;
  image_url: string;
  image_url_mobile?: string | null;
  target_url: string;
};

const SLOT_SIZES: Record<string, string> = {
  // Responsive heights: shorter on mobile, taller on desktop so the banner
  // keeps a sensible shape at both content widths (full width on mobile,
  // max-w-3xl on desktop).
  leaderboard: "h-[90px] md:h-[180px]",
  in_content: "h-[140px] md:h-[180px]",
  result: "h-[220px] md:h-[250px]",
};

// Session-scoped ad cancellation. Both keys live in sessionStorage, so they die
// with the tab: reopening the site mints a new session id, the backend has no
// record for it, and the ads come back. That is the product rule -- the user
// cancels once per visit, never permanently.
const AD_SESSION_KEY = "tickless_ad_session";
const ADS_CANCELLED_KEY = "tickless_ads_cancelled";

function adSessionId(): string {
  let sid = sessionStorage.getItem(AD_SESSION_KEY);
  if (!sid) {
    sid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(AD_SESSION_KEY, sid);
  }
  return sid;
}

function adsCancelled(): boolean {
  return sessionStorage.getItem(ADS_CANCELLED_KEY) === "1";
}

/**
 * House ad container. Renders NOTHING when no active ad exists for the slot
 * (no broken boxes, no reserved empty space). The optional className (e.g.
 * margins) is applied only when an ad actually renders, so empty slots
 * leave zero footprint in the layout.
 */
/** Reactive matchMedia hook: true when viewport <= 767px (Tailwind's mobile breakpoint). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function AdSlot({
  slot,
  className = "",
}: {
  slot: "leaderboard" | "in_content" | "result";
  className?: string;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  // Only ever set from the Cancel click handler, never from an effect. These
  // pages are statically prerendered, so sessionStorage may only be read after
  // mount -- and a session that already cancelled simply never fetches, which
  // leaves `ad` null and renders nothing without any state update at all.
  const [dismissed, setDismissed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (adsCancelled()) return;
    let stale = false;
    const session = adSessionId();
    fetch(`${API_URL}/api/ads?slot=${slot}&session=${encodeURIComponent(session)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((ads: Ad[]) => {
        if (stale || !ads.length) return;
        const pick = ads[Math.floor(Math.random() * ads.length)];
        setAd(pick);
        fetch(`${API_URL}/api/ads/${pick.id}/impression`, { method: "POST" }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [slot]);

  const cancelAds = () => {
    const session = adSessionId();
    sessionStorage.setItem(ADS_CANCELLED_KEY, "1");
    setDismissed(true);
    // Server-side record too, so the cancellation survives a reload within this
    // session even if the local flag is lost. Failure is fine: the ad is already
    // hidden and the next visit gets a fresh session anyway.
    fetch(`${API_URL}/api/ads/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    }).catch(() => {});
  };

  if (!ad || dismissed) return null;

  return (
    <div className={className}>
      <div className={`glass relative w-full overflow-hidden rounded-2xl ${SLOT_SIZES[slot]}`}>
        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider tx-muted">
          Ad
        </span>
        {/* The wrapper stays pointer-events-none so a click on the Visit label
            still falls through to the ad link underneath it; only Cancel opts
            back in, so the label keeps behaving exactly as before. */}
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
          <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider tx-muted">
            <ExternalLink size={10} /> Visit
          </span>
          <button
            type="button"
            onClick={cancelAds}
            aria-label="Cancel ads for this visit"
            className="pointer-events-auto flex cursor-pointer items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider tx-muted transition-colors hover:bg-black/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          >
            <X size={10} /> Cancel
          </button>
        </div>
        <a
          href={ad.target_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => {
            fetch(`${API_URL}/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
          }}
        >
          {/* Pick the device-specific creative; fall back to desktop when a
              mobile one wasn't uploaded (or vice-versa). */}
          <img
            src={(isMobile && ad.image_url_mobile) || ad.image_url}
            alt="Advertisement"
            className="h-full w-full rounded-2xl border border-[var(--glass-border)] object-cover"
          />
        </a>
      </div>
    </div>
  );
}
