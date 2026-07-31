"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
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
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/ads?slot=${slot}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((ads: Ad[]) => {
        if (cancelled || !ads.length) return;
        const pick = ads[Math.floor(Math.random() * ads.length)];
        setAd(pick);
        fetch(`${API_URL}/api/ads/${pick.id}/impression`, { method: "POST" }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slot]);

  if (!ad) return null;

  return (
    <div className={className}>
      <div className={`glass relative w-full overflow-hidden rounded-2xl ${SLOT_SIZES[slot]}`}>
        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider tx-muted">
          Ad
        </span>
        <span className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider tx-muted">
          <ExternalLink size={10} /> Visit
        </span>
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
