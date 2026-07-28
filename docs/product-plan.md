# TikTok Downloader — Product & Implementation Plan

> **Status:** Planning. No code written yet. This is the master blueprint we build from.

**Goal:** Ship a professional, free-to-run web product ("Tickless") that downloads TikTok videos without watermark, treated as a real brand (name, identity, socials, modern responsive UI), not a throwaway script. Built platform-agnostic so Instagram (and more) can be added later under the same brand.

**Product name:** **Tickless** (locked). Plays on "tick" (TikTok) + "less" (no watermark, less friction). Generalizes cleanly to a multi-platform downloader brand.

**Multi-platform vision:** Tickless is a family/umbrella brand. TikTok is app #1; Instagram, YouTube Shorts, etc. plug in later behind the same UI and a modular backend "extractor" interface. Architecture below is designed for this from day one.

**Architecture (one line):** Next.js frontend on Vercel talks to a Python (FastAPI) + yt-dlp backend on Render; the backend extracts the clean video URL from TikTok and streams/redirects it to the user. No paid APIs.

---

## 1. Brand & Product Identity

A real product needs a name that is short, brandable, not trademark-conflicting with "SnapTik/SSSTik/TikMate", and has domain + social handle availability potential.

### Name: LOCKED — **Tickless**
- Reads as "tick-less": no watermark, no friction, no cost.
- Not a direct SnapTik/SSSTik clone name -> safer for a real brand.
- Umbrella-ready: "Tickless for TikTok", "Tickless for Instagram" later.
- Handles/domains to check: tickless.app, tickless.io, gettickless.com, @tickless / @gettickless on socials.
- Minor note: "tickless" is also a Linux kernel term (tickless kernel) — irrelevant to consumers, no trademark/brand conflict for this product category.

### Brand colors — LOCKED (unique, platform-neutral for umbrella brand)
Since Tickless is multi-platform, the brand must NOT lean on TikTok's red/cyan or any single platform's colors. Chosen direction: **deep midnight + luminous cyan-to-lime signal accent** — feels like a fast, modern utility ("scan / extract / done"), distinct from every competitor and neutral enough to sit above TikTok, Instagram, etc.

```
--brand-primary:   oklch(0.78 0.16 195)   /* luminous cyan (primary CTA) */
--brand-accent:    oklch(0.86 0.19 130)   /* electric lime (highlight)   */
--brand-deep:      oklch(0.55 0.15 265)   /* indigo depth (gradients)    */
--bg-base:         oklch(0.15 0.015 240)  /* midnight slate              */
--bg-elevated:     oklch(0.20 0.02 240)   /* card surface                */
--glass-tint:      oklch(0.70 0.04 210 / 0.10) /* frosted glass fill     */
--glass-border:    oklch(0.90 0.02 210 / 0.18) /* 1px glass edge         */
--text-primary:    oklch(0.98 0.005 240)
--text-muted:      oklch(0.68 0.02 240)
--success:         oklch(0.80 0.17 155)
--danger:          oklch(0.68 0.20 25)
```

Signature gradient: `linear-gradient(135deg, cyan -> lime)` for the logo, primary button, and hero accent glow. Midnight glass cards float over a subtle indigo->midnight mesh. This cyan/lime "signal" pairing is fresh in this category (competitors are all red/pink/blue) and scales to a family of apps.

### Brand assets to produce (in build phase)
- **Logo: NO custom logo yet — LOCKED.** Use the wordmark "Tickless" set in the brand font (Geist Sans, heavy weight, with the cyan->lime gradient applied as text fill) everywhere a logo is required: navbar, footer, favicon (stylized "T"), OG image. A custom logo glyph is deferred; the styled wordmark IS the identity for v1.
- Favicon / app icons (96, 192, 512) — gradient "T" on midnight, generated from the wordmark.
- OG social share image (1200x630) — wordmark + tagline on brand background.
- Social handles to reserve: X/Twitter, Instagram, TikTok, a landing email.

### Brand font — LOCKED
- **Geist Sans** (Vercel's open-source variable typeface) for all UI/headings/body.
- **Geist Mono** for the URL input field and any technical/mono text.
- **Self-hosted via `next/font`** so the site NEVER falls back to the user's device font — consistent rendering on every device. No Google Fonts CDN call, no layout shift.
- Rationale: modern, distinctive, professional, and deliberately NOT Inter/Roboto/Poppins (the overused defaults that read as "template"). Free, variable, pairs perfectly with the Vercel stack.

### Anti-"AI-generated look" rules — LOCKED (applies to the whole site)
Research-backed tells to AVOID (these instantly read as AI/template):
- No generic purple/violet gradients (why we moved to cyan->lime midnight).
- No dead-centered hero with a single lonely CTA and nothing else.
- No untouched default shadcn components — restyle to the brand.
- No perfectly uniform, evenly-spaced identical feature-card grids.
- No emoji used as feature icons — use a real icon set (Lucide), styled.
- No filler/stock marketing copy ("Empower your workflow", "Seamlessly...").
- No em-dashes anywhere in site copy (—). Use commas, "and", "which", or parentheses. (User standing rule.)
Positive rules to APPLY:
- Distinctive typography (Geist), intentional/asymmetric spacing and section rhythm, real specific copy, custom accent details, motion with restraint, and glass used only on key elements.

---

## 2. How the Product Works (technical core, confirmed)

The watermark-free file already exists on TikTok's servers (`play_addr`); the app just fetches it — no image processing, no ML. Two extraction strategies:

- **Primary:** `yt-dlp` (free, open source, best-maintained TikTok extractor).
- **Fallback:** direct call to TikTok's internal `aweme` endpoint with spoofed device headers, reading `play_addr` from JSON.

**Critical reliability fact:** TikTok periodically breaks yt-dlp's extractor. Mitigation is non-negotiable: the backend must auto-update yt-dlp to nightly on every deploy/boot, and we ship the direct-endpoint fallback so one breakage doesn't take the whole product down.

---

## 3. Architecture & Hosting (free-tier reality)

```
[ Browser ]
     |
     v
[ Vercel ]  <- Next.js frontend (static + light API routes)
     |  fetch()
     v
[ Render ]  <- FastAPI + yt-dlp + ffmpeg (Docker)
     |
     v
[ TikTok CDN ] -> clean MP4 URL returned to browser
```

### Render free-tier constraints (confirmed) and how we design around them
- **Spins down after 15 min idle, ~60s cold start.** -> Frontend shows a friendly "waking up the server" skeleton state; optional cron ping to keep warm during launch. Do NOT promise instant first response.
- **Ephemeral filesystem (files lost on spin-down/redeploy).** -> NEVER store finished videos on disk long-term. Prefer **redirect the browser straight to TikTok's CDN URL** (zero bandwidth cost, zero storage) whenever possible. Only proxy/merge server-side for slideshow->MP4, and stream it, don't persist.
- **750 instance hours/month + capped bandwidth.** -> Redirect-not-proxy keeps our bandwidth near zero. This is the single most important architectural decision for staying free.
- **No payment card = hard suspend if limits hit.** -> Stay redirect-based; monitor usage.

### Why redirect > proxy (key insight)
If we proxy the video bytes through Render, every download eats our bandwidth and instance time -> we hit free limits fast. Instead, backend returns the CDN URL and the browser downloads directly from TikTok. Render only does the tiny JSON extraction work. This is how you stay genuinely free at small/medium scale.

Slideshow posts are the exception (must merge images+audio with ffmpeg server-side); stream the result, delete immediately.

---

## 4. Tech Stack

**Frontend (Vercel):**
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (OKLCH theme tokens above)
- shadcn/ui for accessible primitives
- Framer Motion for micro-interactions
- next/font, next/image for perf

**Backend (Render, Docker):**
- Python 3.12 + FastAPI + uvicorn
- yt-dlp (auto-updated nightly), ffmpeg (for slideshow merge)
- Direct-endpoint fallback module
- CORS locked to the Vercel domain

**Shared:**
- GitHub monorepo (`/frontend`, `/backend`) — user is `vip-ultr`, SSH already set up.
- Rate limiting (per-IP) to protect the free box.

---

## 5. UI / UX Design (modern: glassmorphism + skeleton, strict responsive)

### Design language
- **Glassmorphism:** frosted glass cards (`backdrop-blur`, semi-transparent `--glass-tint`, 1px light border, soft shadow) floating over a violet->mint gradient mesh background.
- **Skeleton UI:** while extracting, show shimmer skeleton placeholders for the result card (thumbnail, title, buttons) instead of a spinner. Feels fast and premium.
- **Motion:** subtle fade/slide on result reveal, button press states, gradient shift.

### Responsive strategy (strict, separate mobile view + nav — user requirement)
- **Mobile-first** build. Breakpoints: base (mobile) -> `md` (tablet) -> `lg` (desktop).
- **Desktop nav:** horizontal glass navbar, logo (Tickless wordmark) left, links center/right, CTA button.
- **Mobile nav — LOCKED (bottom sheet):** separate component. A menu button triggers a glass panel that **slides UP from the bottom of the screen to roughly half the viewport height** (a bottom sheet), not a top slide-over. This matches the modern glass aesthetic and is thumb-friendly. Requirements: swipe-down to dismiss, tap-scrim-to-dismiss, hardware/browser Back dismisses it (NNG guideline), rounded top corners, drag handle affordance at top, frosted glass with the brand tint. Provide a non-blur fallback for old devices.
- **Hero/input:** single large paste field + Download button; stacks vertically on mobile, side-by-side hint on desktop.
- **Result card:** full-width on mobile, centered max-width card on desktop.
- Test at 360px, 390px, 768px, 1024px, 1440px.

### Pages
1. **Home / Downloader** — hero, paste input, how-it-works (3 steps), features grid, FAQ.
2. **About** — brand story, mission.
3. **FAQ** — dedicated, SEO value.
4. **Legal** — Terms, Privacy, DMCA/copyright disclaimer (important for a public tool).
5. **404** — branded.

### SEO / product polish
- Metadata, OG image, sitemap, robots.txt, JSON-LD FAQ schema.
- Fast Lighthouse scores (static frontend helps).

---

## 6. Feature Scope

### v1 (MVP — launch)
- Paste TikTok link -> get no-watermark MP4 (HD when available).
- Download audio (MP3) button.
- Copy/paste + basic URL validation, clear error states.
- Full responsive UI, glass + skeleton, mobile nav.
- Legal pages, branding, socials live.

### v2 (post-launch)
- Slideshow (photo post) -> MP4 merge.
- Multiple quality options.
- Batch (multiple links).
- Light/dark toggle (ship dark-first).
- Simple analytics (privacy-friendly, e.g. Plausible free/self-host or Vercel Analytics).

### Explicitly deferred (YAGNI now)
- User accounts, history, proxies/IP rotation, mobile apps. Handle at scale later.

---

## 7. Legal / Risk (must acknowledge before public launch)
- Violates TikTok ToS; redistributes third-party content. Fine for personal/small use; add clear DMCA + "for personal use / content you own" disclaimer.
- Do not store user data or download history (privacy = feature, like SnapTik markets).
- No copyrighted-music MP3 as a headline feature (SnapTik deliberately avoids this) — keep audio extraction modest.

---

## 8. Build Phases (high-level; detailed task breakdown comes after name/branding is locked)

**Phase 0 — Decisions & setup**
- Lock product name + palette (USER INPUT NEEDED).
- Create GitHub monorepo, scaffold `/frontend` and `/backend`.
- Reserve social handles + (optional) domain.

**Phase 1 — Backend core**
- FastAPI service, `/api/extract?url=` endpoint.
- yt-dlp integration returning CDN URL + metadata (thumbnail, title, author, duration).
- Auto-update yt-dlp on boot; direct-endpoint fallback.
- Dockerfile, deploy to Render, verify with a real link.

**Phase 2 — Frontend core**
- Next.js scaffold, Tailwind v4 theme tokens, shadcn.
- Home page: hero + paste input + validation.
- Wire to backend, result card with skeleton loading + download button.
- Cold-start friendly "waking server" state.

**Phase 3 — Design polish + responsive**
- Glassmorphism system, gradient mesh bg, motion.
- Desktop navbar + separate mobile nav/slide-over.
- All breakpoints verified.

**Phase 4 — Brand + content + legal**
- Logo, favicons, OG image (image tool).
- About, FAQ, Terms/Privacy/DMCA.
- SEO metadata, sitemap, JSON-LD.

**Phase 5 — Launch**
- Deploy frontend to Vercel, connect domain.
- Keep-warm cron during launch window.
- Socials live, share.

**Phase 6 — v2 features** (slideshow, batch, quality options).

---

## 8.5 Operations, Security, Ads & Admin (ALL LOCKED)

### A. Security & config (CRITICAL, locked)
- **CORS:** backend allows requests ONLY from the Vercel prod domain + localhost for dev. All other origins rejected.
- **Shared API token:** frontend sends a secret header (`X-Tickless-Key`) with each extract call; backend rejects requests without it. Stops randoms using our server as a free API. Token stored as env var on both Vercel and Render, never committed.
- **Env strategy:** `.env.local` (gitignored) for dev; Render/Vercel dashboard env vars for prod. A committed `.env.example` documents required keys.
- **Input hardening:** reject URLs over 500 chars, reject non-TikTok hosts BEFORE calling yt-dlp, strip/validate the URL.

### B. Rate limiting (CRITICAL, locked)
- **In-memory limiter** (slowapi for FastAPI): 10 requests / minute / IP for `/api/extract`. Resets on spin-down (acceptable on free tier).
- Return HTTP 429 with the friendly "slow down" message. Admin routes limited separately and behind auth.

### C. Legal / DMCA (CRITICAL, locked)
- Operating entity: **Optivis Labs** (already the user's studio).
- Contact: a dedicated email (e.g. hello@ / abuse@ — free, set up at launch). Copyright page names it for takedowns.
- Terms/Privacy/Copyright pages ship in v1 (copy already locked in content doc).

### D. Monitoring & health (CRITICAL, locked)
- **Error tracking:** Sentry free tier on BOTH frontend and backend. Captures the moment yt-dlp breaks.
- **Analytics:** Vercel Web Analytics (free, privacy-friendly, no cookie needed) for traffic. Gated behind cookie consent only if it ever uses cookies; Vercel Analytics is cookieless so it can run always.
- **Daily health-check cron (item 5, locked):** an automated job pings the backend with a known-good TikTok link once daily. If extraction fails, it alerts (email/Telegram) so we fix yt-dlp before users complain. This is the #1 insurance against silent death.

### E. Repo, CI, deploy (item 6, locked)
- **Monorepo** `tickless/` with `/frontend` and `/backend`. GitHub owner: vip-ultr (SSH already configured).
- **Branches:** `main` = production (auto-deploys). Feature branches -> PR -> merge. Vercel auto-builds previews per PR; Render auto-deploys `main`.
- **Git identity** set locally per repo before first commit (host quirk).
- **.gitignore:** node_modules, .next, .env*, __pycache__, venv. Never commit secrets or the junk `pnpm-workspace.yaml`.

### F. Testing (item 7, locked)
- Backend: pytest — URL validation unit tests + a live-extraction test (doubles as the health-check).
- Frontend: manual responsive QA checklist at 360/390/768/1024/1440 via `pnpm dev` + Windows localhost:3000 (browser automation unavailable on this host).
- Build verification: `./node_modules/.bin/next build` + `./node_modules/.bin/eslint .` (NOT `pnpm run build` — host quirk).

### G. Accessibility & performance (item 8, locked)
- Keyboard nav + focus trap for the mobile bottom sheet; Escape and Back close it.
- WCAG AA contrast: verify cyan/lime on midnight passes (adjust tokens if needed).
- `prefers-reduced-motion` respected for all animations.
- Alt text on all images/thumbnails. Semantic HTML. Lighthouse target: 90+ across the board.

### H. Assets pipeline (item 9, locked)
- OG image (1200x630) + social cards: generated with the image tool from the wordmark.
- Favicon set (16/32/96/180/192/512) + `manifest.json` for add-to-home-screen (PWA-lite, no offline yet).
- All assets in `/frontend/public`.

### I. Cookie consent (item 10, locked — REQUIRED per user)
- **Library:** vanilla-cookieconsent (orestbida) — free, open source, GDPR-compliant, framework-agnostic, lightweight.
- Styled to the brand (glass + midnight). Categories: strictly-necessary (always on), analytics, advertising.
- Ads/analytics that use cookies only fire AFTER consent. Vercel cookieless analytics may run pre-consent. Consent choice stored and re-openable from the footer ("Cookie settings").

### J. Ads system + placements (items 11 & 14, locked)
Revenue model: **house ads now** (self-served via admin), designed so Google AdSense / a network can slot into the SAME containers later without redesign.

**Ad placements (chosen for professional, non-intrusive design — research-backed):**
1. **Top leaderboard** — a slim banner ABOVE the hero on desktop, below the fold-safe zone on mobile. 728x90 desktop / 320x100 mobile. Clearly labeled "Ad".
2. **In-content rectangle** — one 300x250 unit BETWEEN the "How it works" and "Why Tickless" sections. Feels native, not interruptive.
3. **Result-area sidebar/below** — a single unit near the result card (below on mobile, beside on wide desktop) — high attention without blocking the download.
Rules: NO pop-ups, NO auto-play sound, NO sticky full-width mobile overlays, max 3 units per page, every unit reserves fixed height (no layout shift), each labeled "Ad". Ads never cover the input or download buttons.

**Ad delivery:** frontend fetches active ads from `GET /api/ads?slot=<slot>` at load; renders image + click-through link; records an impression. Empty slot renders nothing (no broken boxes).

### K. Admin panel for ads (item, locked)
- **Route:** `/admin` on the frontend, protected by login.
- **Auth:** single admin account, credentials in env; session via signed JWT/httpOnly cookie. (No public sign-up.)
- **Features:** upload ad creative (image), set click-through URL, choose slot (leaderboard / in-content / result), set active/inactive, set optional start/end dates, delete ad, view impression/click counts.
- **Backend:** FastAPI admin routes (`/api/admin/ads` CRUD) behind auth + rate limit.
- **Storage:** **Supabase free tier** — Postgres for ad records + counts, Supabase Storage for the uploaded images. (Chosen over Render Postgres, which EXPIRES after 30 days; Supabase free is persistent and includes file storage.) Free, no card.
- **Data model (ads table):** id, slot, image_url, target_url, is_active, starts_at, ends_at, impressions, clicks, created_at.

### L. Deferred but noted (items 12-13)
- Custom domain (tickless.app) + branded email: deferred, on free subdomains now.
- Real ad network (AdSense) approval: deferred (needs domain + traffic); containers built network-ready.
- Proxy/IP rotation for scale: deferred by design.
- i18n / multi-language: deferred.

---

## 9. Cost Summary (answering "is it completely free?")
- APIs: **$0** (yt-dlp + TikTok endpoint, no keys).
- Tools: **$0** (open source, ffmpeg).
- Frontend hosting: **$0** (Vercel free).
- Backend hosting: **$0** (Render free — redirect-based design keeps us under bandwidth/hours limits).
- Ad DB + image storage: **$0** (Supabase free tier, persistent).
- Monitoring: **$0** (Sentry free, Vercel Analytics free).
- Domain: **optional** — only real potential cost (~$10/yr). Can launch on free `*.vercel.app` + `*.onrender.com` subdomains at $0.

**Verdict: buildable and runnable at $0** for personal/small scale. Only proxies/bandwidth cost money later at viral scale, deferred by design.

---

## 10. Decisions LOCKED
1. **Name:** Tickless.
2. **Palette:** midnight + cyan->lime signal accent (section 1).
3. **Domain:** free `*.vercel.app` (frontend) + `*.onrender.com` (backend) for now; custom domain deferred.
4. **Backend:** FastAPI / Python 3.12 (best yt-dlp fit) — confirmed.
5. **Slideshow-to-MP4:** v2, with a v1 teaser ("Slideshows coming soon" state).
6. **Logo:** no custom logo yet — styled "Tickless" wordmark (Geist, gradient) used everywhere a logo is required.
7. **Font:** Geist Sans + Geist Mono, self-hosted via next/font (never uses device font).
8. **Mobile nav:** bottom sheet that slides up from the bottom to ~half screen (swipe/back/scrim dismiss).
9. **Anti-AI-look rules:** enforced site-wide (section 1).
10. **No em-dashes** anywhere in site copy.
11. **Content doc:** ALL site copy is written and locked in `2026-07-27_tickless-content.md` BEFORE building; build must use that copy verbatim.
12. **Security:** CORS locked to our domain + shared `X-Tickless-Key` header; input hardening (section 8.5-A).
13. **Rate limit:** 10 req/min/IP via slowapi (8.5-B).
14. **Legal entity:** Optivis Labs; DMCA contact email at launch (8.5-C).
15. **Monitoring:** Sentry (FE+BE) + Vercel Analytics + daily health-check cron (8.5-D).
16. **Repo/CI:** monorepo `tickless/`, main auto-deploys, PR previews (8.5-E).
17. **Testing:** pytest backend + manual responsive QA + next/eslint build verify (8.5-F).
18. **A11y/perf:** WCAG AA, reduced-motion, focus trap, Lighthouse 90+ (8.5-G).
19. **Cookie consent:** vanilla-cookieconsent, brand-styled, gates ad/analytics cookies (8.5-I).
20. **Ads:** house ads in 3 non-intrusive slots (leaderboard, in-content, result), network-ready containers (8.5-J).
21. **Admin panel:** `/admin` login-protected, ad CRUD + image upload + stats (8.5-K).
22. **Ad storage:** Supabase free tier (Postgres + Storage), persistent, not Render Postgres (8.5-K).
23. **NO gradients anywhere** (user-approved final design): solid colors only. Buttons/CTAs are GREEN (--brand-accent lime). Wordmark = white "Tick" + green "less". Cyan (--brand-primary) used for secondary accents; cyan+green alternate on feature icons; subtle cyan+green hints in the background mesh.
24. **Glass recipe (approved):** cards `.glass` = blur(24px) sat(180%), light tint, inset top highlight. Navs + bottom sheet + dropdowns `.glass-strong` = blur(200px) sat(160%), oklch(0.16 0.02 240 / 0.88) tint. Non-blur fallbacks included.
25. **Text colors via custom @utility classes** (`tx`, `tx-muted`, `tx-brand`, `tx-accent`) — Tailwind v4 arbitrary-value text classes proved unreliable in dev; never use `text-[var(--…)]` in this codebase.
26. **Mobile bottom sheet (approved):** 52vh, drag handle, icon card links with descriptions, glass-strong.
