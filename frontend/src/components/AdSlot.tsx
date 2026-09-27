"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
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

// Ad cancellation lasts exactly one page load. Deliberately nothing here is
// written to storage: this module is re-evaluated on reload, which mints a new
// token and resets `adsDismissed`, so refreshing brings the ads straight back.
// Client-side navigation keeps the module alive, so the cancellation still
// covers the rest of the visit -- it just never survives a reload.
let pageToken: string | null = null;

function pageViewId(): string {
  if (!pageToken) {
    pageToken =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  return pageToken;
}

// Held at module scope so one press hides every slot, including the ones
// already on screen. Read through useSyncExternalStore rather than component
// state: there is no single component that owns it, and the server snapshot
// keeps the statically prerendered pages away from anything browser-only.
let adsDismissed = false;
const dismissListeners = new Set<() => void>();

function getDismissed(): boolean {
  return adsDismissed;
}

function getServerDismissed(): boolean {
  return false;
}

function dismissAds(): void {
  if (adsDismissed) return;
  adsDismissed = true;
  dismissListeners.forEach((listener) => listener());
}

function subscribeToDismissal(listener: () => void): () => void {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

// ─── one request per page load ───────────────────────────────────────────────
// A page renders two or three slots, and each used to make its own round trip
// to the backend. The endpoint already returns every active ad when no slot is
// named, so it is called once here and split by slot in the effect below.
//
// It also starts at module evaluation instead of in useEffect: an effect only
// runs after React has hydrated, and that wait was the single largest gap
// between the page becoming visible and an ad appearing. Because the module
// survives client-side navigation, moving between pages reuses the same
// promise and costs no further requests.
let adsForPage: Promise<Ad[]> | null = null;

function loadAds(): Promise<Ad[]> {
  if (!adsForPage) {
    const session = encodeURIComponent(pageViewId());
    adsForPage = fetch(`${API_URL}/api/ads?session=${session}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((ads) => (Array.isArray(ads) ? (ads as Ad[]) : []))
      .catch(() => {
        // Clear rather than pin the failure for the whole session: a cold
        // Render instance behind this request is the usual cause, and the next
        // mount should get another chance at it.
        adsForPage = null;
        return [] as Ad[];
      });
  }
  return adsForPage;
}

// Kicked off as soon as this chunk evaluates. Guarded because Next also
// evaluates the module while prerendering, where there is no page view to
// load ads for -- letting that run would fire a request at the API during
// every build.
if (typeof window !== "undefined") void loadAds();

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
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    getDismissed,
    getServerDismissed,
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (getDismissed()) return;
    let stale = false;
    loadAds().then((ads) => {
      const mine = ads.filter((a) => a.slot === slot);
      if (stale || mine.length === 0) return;
      const pick = mine[Math.floor(Math.random() * mine.length)];
      setAd(pick);
      fetch(`${API_URL}/api/ads/${pick.id}/impression`, { method: "POST" }).catch(() => {});
    });
    return () => {
      stale = true;
    };
  }, [slot]);

  const cancelAds = () => {
    dismissAds();
    // Tell the backend too, keyed on this page-load token: any slot that mounts
    // later in the same view is then filtered server-side, even if the local
    // flag were lost. The token is never persisted, so a reload presents an
    // unknown one and the ad comes back on its own. Failure is harmless -- the
    // slots are already hidden.
    fetch(`${API_URL}/api/ads/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: pageViewId() }),
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
            <X size={14} />
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
              mobile one wasn't uploaded (or vice-versa). fetchPriority keeps
              the creative ahead of anything else the page asks for once it is
              known, and async decoding keeps it off the main thread while the
              page is still settling. */}
          <img
            src={(isMobile && ad.image_url_mobile) || ad.image_url}
            alt="Advertisement"
            decoding="async"
            fetchPriority="high"
            className="h-full w-full rounded-2xl border border-[var(--glass-border)] object-cover"
          />
        </a>
      </div>
    </div>
  );
}
