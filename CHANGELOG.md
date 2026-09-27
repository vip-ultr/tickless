# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries use these categories: **Added** for new features, **Changed** for changes
in existing behaviour, **Deprecated** for features being phased out, **Removed**
for features taken out, **Fixed** for bug fixes, and **Security** for
vulnerability fixes. The newest release comes first and dates are ISO 8601.

Versions were cut retroactively from the commit history — each heading links to
the commit range it shipped — and work that has landed but has not been cut yet
lives under [Unreleased].

## [Unreleased]

### Added

- **Multi-select carousel downloads.** Gallery chips are toggleable — one tap
  ticks the item *and* moves the single-item preview to it, so the single-item
  **Download** keeps behaving exactly as it did. Ticking two or more relabels
  that button to **Download (N)** and points it at the staged items through the
  same staggered loop; with none or one ticked it stays a native `<a href>`,
  which deliberately keeps it off the CORS path the filename fix below depends
  on. Chips carry `aria-pressed` for assistive tech, selected indices are
  clamped to the current gallery length, and both bulk actions disable under a
  shared "Preparing your files…" status while a run is in flight.
- **Select all** is a primary action of its own: a `ListChecks`-icon button
  that stages the whole carousel in one tap, ready for **Download (N)**. This
  is what takes over from Download all below.
- **Cancel ads for the current page load.** Every house ad now carries a small
  **Cancel** control beside its **Visit** badge. Pressing it hides the ad slots
  for the rest of the page view and records the cancellation against a token
  the frontend mints in memory. Nothing is written to storage, so a reload mints
  a fresh token the backend has never seen and the ad comes back immediately —
  the opt-out lasts exactly one page load and is never permanent, while
  client-side navigation keeps it alive for the rest of the visit. Nothing is
  keyed on IP or login, either of which would leak it into a later load.
  Server-side, `POST /api/ads/dismiss` records the cancellation and
  `GET /api/ads?session=…` honours it, so a slot that mounts after the press is
  filtered too even if the local flag were lost; its TTL only bounds how long an
  orphaned record lingers — it is not what brings the ad back, the fresh token
  is. The store is process-local and hard-capped rather than Supabase-backed:
  it is per-page-view state, it should evaporate on restart, and it must not
  accumulate rows for an unauthenticated endpoint. The **Visit** label keeps its
  old behaviour — it sits in a `pointer-events-none` wrapper so clicks still
  fall through to the ad link, and only **Cancel** opts back in.
- **Structured data (JSON-LD).** `FAQPage` on `/faq`, plus `HowTo` and
  `WebApplication` on `/`. All three are generated from the same `FAQS` and
  `STEPS` constants the visible copy renders from, so the schema and the page
  cannot drift apart, and `<` is escaped on the way out so a value can never
  close its own `<script>` tag. Deliberately no `AggregateRating`: there are no
  real ratings to report, and asserting them would be a manual action under
  Google's search spam policies. Before this the site had no structured data at
  all, so none of its FAQ or how-to content was eligible for rich results or
  for the answer engines.
- **`llms.txt`, served at `/llms.txt`.** A short plain-text summary of what
  Tickless is plus a link to every page, written for the crawlers that fetch it
  before they fetch HTML. Speculative upside only, but it costs one static file.
- **A daily extraction health check** (`.github/workflows/health-extract.yml`)
  that calls `/api/health/extract` once a day at 08:07 UTC. That endpoint runs a
  real extraction against a known-good TikTok link and returns 503 with an error
  code when the extractor is broken. Until now the keep-warm workflow was the
  only automated probe and it deliberately never touched yt-dlp, so a TikTok
  signature change could break every download while every liveness check stayed
  green. It is scheduled inside the 08:00-21:59 UTC keep-warm window so it
  reuses a boot that is happening anyway and adds no Render instance-hours.
- **Backend error tracking with Sentry** (`sentry-sdk[fastapi]`). Initialised
  only when `SENTRY_DSN` is set, with `send_default_pii` off so events carry
  nothing that would contradict the privacy promise. Without a DSN the SDK is
  never even imported, so local and CI runs are exactly what they were before.
  Paste a DSN into the Render dashboard to turn it on. Frontend tracking is not
  part of this change.

### Changed

- **The `docs/` set was brought current with the code** for the first time
  since most of it was written in July. Every document now carries a
  *Written* / *Last updated* header and an honest status, and
  `docs/README.md` is a real index with the maintenance rules (bump the date,
  never delete a decision silently, feature plans become records once they
  ship).
  `product-plan.md` no longer claims "No code written yet": the extraction
  section describes the Cobalt -> yt-dlp -> embed-markup cascade instead of the
  never-built `aweme` fallback, the architecture diagram gained the sidecar and
  Supabase, feature scope lists what ships and what is still open from v2, and
  every build phase has a status. Its monitoring section was corrected: the
  keep-warm workflow pings health endpoints and **no** scheduled job tests
  extraction, and Sentry was never wired up.
  Its brand-colour block is marked as superseded by locked decision 23, since
  the shipped palette is green primary with no gradients and the two
  contradicted each other.
  `clip-feature-plan.md` and `instagram-plan.md` are marked shipped with the
  releases that carried them, and flag the three places the code moved on
  (carousels, the removed `/instagram` route, YouTube).
  `content.md` was reconciled against the frontend for the first time since it
  was written: Instagram, Clip, PWA, consent and ad strings added; the quality
  selector, "Download another" and the slideshow teaser removed as never
  shipped; error copy matched to `ERROR_MESSAGES`; section 10 logs all of it.
  `growth-strategy.md` gained a "where this stands" block tracking which SEO
  items are done and which are left, `legal-posture.md` was reviewed and its
  health-check claim corrected, and both were revised again once the gaps the
  block identified (JSON-LD, `llms.txt`, the `/clip` and `/dmca` sitemap
  entries) were closed the same day.
- **Clear** is now a text-weight control with a `--danger` hover tint rather
  than a third full-size button, matching the subtle-destructive pattern
  already used in the admin panel. The action row reads as two primary buttons
  plus one quiet affordance.
- **Audio (MP3) now sits before Clear** in the gallery action row. The audio
  control is a real, full-sized action, so it belongs alongside Download and
  Select all; Clear is the quiet destructive affordance and now trails the row
  rather than splitting the two groups apart.

### Fixed

- **"Download all" produced wrong filenames and file types.** Files arrived as
  `tickless_<entire caption>_1` with no extension, so Windows showed an unknown
  "file" and photos and videos were indistinguishable — while a single-item
  download of the same post produced the correct
  `user - caption_1 - Tickless.jpg`. One cause covered both symptoms:
  `CORSMiddleware` set `allow_headers` (the *request* direction) but never
  `expose_headers`, so a cross-origin `fetch()` was not permitted to read
  `Content-Disposition` and the frontend silently fell back to an uncapped,
  extensionless name. A plain `<a href>` navigation is not subject to CORS,
  which is exactly why the two paths disagreed — the backend was already
  computing the right name. The API now exposes `Content-Disposition`, and the
  frontend fallback mirrors `build_download_filename()` (hashtag and
  filesystem-character stripping, the 40-char caption cap, the `_N` index
  suffix) and derives the extension from the bytes actually received, so a
  photo can never be saved as a video even if the header goes missing again.
  Covered by `test_cors_exposes_content_disposition`, A/B verified to fail
  without the fix.
- **On mobile the action row collapsed into a distorted vertical stack** as
  soon as the label grew to "Download (N)" — two controls that should sit side
  by side pushed each other onto their own lines and came out misshapen. The
  two primary controls now live in a fixed two-column grid, which cannot stack
  at any viewport width, with Clear flex-wrapping onto its own line only when
  there is genuinely no room left for it.
- **The FAQ told users to press a button that no longer exists.** Two answers
  said "use Download all" and "hit Download all", but that control was replaced
  by **Select all** plus **Download (N)** when multi-select landed. Both now
  name the buttons that are actually on screen.
- **The homepage promised a quality selector that was never built.** The hero
  subhead said "pick your quality" and How-it-works step 3 said "Pick HD,
  standard, or audio", while the result card offers exactly one video file plus
  audio. Both strings now describe what happens. A real quality picker is still
  an open v2 feature rather than something the copy advertises.
- **`/clip` and `/dmca` were missing from the sitemap**, so neither page was
  ever offered to crawlers. The sitemap now lists all eight public routes with
  per-page priorities and still omits `/admin`.
- **`robots.txt` named no AI crawler.** It was a single blanket `*` entry, which
  left the answer-engine bots to an implicit default and would have been
  silently overridden by any later blanket rule. They now get an explicit
  allow-list ahead of the catch-all.

### Removed

- **Download all.** Select all stages the carousel and **Download (N)** fires
  it, so the same capability is reachable without a third competing button.
- The `mobile/` React Native app, which was never part of a release. Its source
  stays recoverable from git history, and the `docs/mobile-app-{research,plan,
  handoff}.md` planning notes went with it so contributors aren't pointed at an
  app the repo doesn't contain.

## [1.0.0] - 2026-09-26

First stable cut: the point at which the deployed product and the repository
agree.

### Added

- **Instagram single-image posts download again.** Static (`GraphImage`) posts
  were the one Instagram shape that still failed, with `error.api.fetch.empty`.
  Instagram answers the embed page with `contextJSON: null` for them, so every
  structured stage of the extraction cascade (mobile API → embed JSON → web
  GraphQL) came back empty — even though the file was sitting in that same page
  as `<img class="EmbeddedMediaImage">`. `parseEmbedMarkup()`
  (`backend/cobalt/api/src/processing/services/instagram.js`) is a strictly
  last-resort stage that scrapes that markup and rebuilds the `shortcode_media`
  node `extractOldPost()` already consumes, so filenames, `isPhoto → redirect`
  and the caption / author / cover forwarding are all untouched. It only runs
  once every structured stage has failed and refuses anything that is not a
  static `GraphImage`, so carousels (which get a populated `contextJSON`) and
  reels (which render no `EmbeddedMediaImage` at all) always keep their existing
  paths.
- Offline regression test `test_ig_single_image_embed_markup_fallback`, driven
  from `backend/test_backend.py` against real saved embed pages in
  `backend/fixtures/`. It asserts the recovered URL, username, caption and media
  id, and that sidecar, video and reel-style pages are refused. The suite moved
  from `45 passed, 1 failed` to `47 passed, 4 skipped`.
- PNG icons in the web manifest so installing the PWA shows the real artwork
  instead of a generic glyph.
- Vercel Web Analytics (`@vercel/analytics`), cookieless and aggregated.

### Changed

- `requestHTML()` returns `false` when the embed page's `init` payload is
  missing or malformed, instead of throwing out of `getPost()`'s single `try`
  block where it silently skipped the GraphQL stage.
- README attribution now links to `optivislabs.com`; unused Next.js boilerplate
  SVGs removed from `public/`.

## [0.6.0] - 2026-08-28

Instagram reliability pass, plus Clip editor interaction fixes.

### Added

- An outbound proxy scoped to the Cobalt sidecar to get past Instagram's
  per-IP rate limits, with an end-to-end proxy self-test that fails loudly if
  the proxy cannot reach Instagram.
- Instagram caption, author and public cover URL now flow through
  `match-action` into the Cobalt response, so photo posts preview with the same
  metadata TikTok posts already had.
- Clip: **Play** toggles to **Pause**, and playback auto-pauses when a trim
  handle is dragged.

### Fixed

- Single-image Instagram posts only resolved through the loopback tunnel; the
  photo now uses the public CDN redirect.
- TikTok image previews, unique filenames for multi-image posts, and captions
  being truncated too aggressively.
- Clip: Play/Pause now truly pauses and resumes, and the player only resets
  when the selected range changes — not on every handle move.
- Clip editor video height capped so it stays responsive on desktop.

## [0.5.0] - 2026-08-13

Clip ships.

### Added

- **Clip** (`/clip`): turn one source video into many manual segments, plus
  audio-only extraction. `POST /api/clip/upload` parks a pasted-link or uploaded
  source (max 500 MB) and returns a token and duration; `POST` / `GET /api/clip`
  trims one `[start, end]` segment — video or audio-only — and streams it back.
  Nothing is persisted: sources are trimmed lazily on download and the temp dir
  is purged after an hour by a background sweep. The navbar links to `/clip`.
- `.env.example` documents the Clip environment variables.

### Fixed

- Clip downloads did nothing: the frontend used `fetch` → `blob` → `a.click()`,
  which silently fails because a programmatic click outside a user gesture is
  ignored. `/api/clip` also accepts `GET` (query parameters, API key via `?key=`
  like `/api/download`) and the buttons are native `<a href>` links, so the
  browser actually saves each clip. Verified end-to-end against a live server.
- The mobile slide nav had a fixed `52vh` height and no scroll, cutting off the
  new Clip link on small screens — now `max-h-[85vh]` with `overflow-y-auto`.
- pnpm 11 `allowBuilds` format restored so CI and Vercel installs pass; pnpm
  version pinned and a root `vercel.json` added for reliable deploys.
- `pnpm-workspace.yaml` repaired so the workspace install is reproducible.
- Instagram `no_media` yt-dlp fallback restored.
- Footer link columns no longer cram on narrow mobile (iPhone / Z Fold), the PC
  "Load video" button no longer wraps, and iOS Safari is responsive again.
- README, product plan and this changelog synced with the Clip feature.

## [0.4.0] - 2026-08-08

Cobalt is co-located with the backend, and Instagram survives a cold start.

### Added

- TikTok photo posts are supported by falling back to Cobalt.
- `backend/conftest.py` so the test suite is order-independent: yt-dlp's plugin
  loader can rebind `sys.modules['extractor']` mid-session, and a meta-path
  finder plus an autouse fixture keeps the local module pinned so
  `cobalt_client` imports resolve regardless of test order.

### Changed

- **Cobalt now runs as a sidecar inside the backend container** instead of a
  second Render service. Render routes service-to-service traffic internally,
  straight at the spun-down container, which refuses the connection instead of
  going through the public proxy that would boot it — so the backend could never
  wake Cobalt and Instagram only worked for about fifteen minutes after a manual
  redeploy. Co-locating them removes that failure mode entirely. Documented in
  the README architecture section.
- Backend image: Node 22 pinned from NodeSource and corepack dropped, and the
  Docker build context made self-contained under `backend/`.
- `/api/extract` runs its extraction work in the threadpool
  (`run_in_threadpool`) so a cold-start warmup of up to `COBALT_WARMUP_BUDGET`
  (~55s) cannot freeze TikTok extraction or health checks for the same user.

### Fixed

- Instagram cold-start 502: the backend no longer fire-and-forgets a single ping
  to Cobalt. `cobalt_client._warm_up_cobalt()` polls until Cobalt actually
  responds (`COBALT_WARMUP_BUDGET`, default 55s; `COBALT_WARMUP_INTERVAL`,
  default 3s), which safely covers Render free tier's measured ~23s cold boot.
  The first Instagram download after idle now waits for Cobalt to wake instead
  of failing with `extractor_down` — no more manual redeploy.
- Instagram login-wall errors (`error.api.fetch.empty`) map to the canonical
  `no_media` message with a clean 400 instead of a generic server error.
- `start.sh` forces `COBALT_URL` to loopback so a stale dashboard env var cannot
  break Instagram.

## [0.3.0] - 2026-08-01

Legal, community, CI, and the cookie-less YouTube path.

### Added

- Cookie-less YouTube bot-wall defeat via a PO-token provider built on a Rust
  crate, so no npm package or Chrome binary is needed and the Docker image still
  builds.
- Professional Terms, Privacy and Copyright pages, a DMCA takedown page, the
  founder-level legal-posture document, and a rewritten README.
- Tier A + Tier B community files: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `NOTICE`, this `CHANGELOG.md`, a CI workflow, and
  `frontend/.env.example`.
- YouTube cookie diagnostics: `/api/health/extract` and `/api/health/config`
  report cookie and PO-token wiring without leaking any value, and neither ever
  returns a 500.

### Changed

- YouTube dropped from the frontend copy; the backend extraction path is
  untouched.

### Fixed

- Instagram `error.api.fetch.empty` returns a clean `no_media` (400) instead of
  a 502.
- Instagram 502 on Render cold start: warm up Cobalt and retry 5xx responses.
- YouTube geo/country locks, bot-wall prompts, and missing-Node signature
  solving each produce a specific, clean error rather than a 500.
- A unified `ExtractionError` class so Cobalt failures surface as errors the
  client can map instead of an unhandled 500.

## [0.2.0] - 2026-07-31

Instagram arrives on a self-hosted Cobalt, galleries work, and a long
deploy-hardening run lands.

### Added

- **Instagram downloads via a self-hosted Cobalt instance**, with a dedicated
  `cobalt_client` and routing tests in `backend/test_cobalt.py`. Vendored Cobalt
  lives in `backend/cobalt/` and is built into the image.
- Instagram carousel and photo-only posts through Cobalt's picker, an item-aware
  gallery UI with per-item downloads, and a Download-all button.
- YouTube download through yt-dlp on the single-page flow, plus a cookie auth
  path and a cookie-less browser fallback.
- PWA install (add-to-home-screen) with an ordering fix for the install card.
- Per-device ad creatives (desktop and mobile) with a fallback and an
  at-least-one rule.

### Changed

- Brand pass: green becomes the primary colour and blue the accent, the wordmark
  is recoloured, and the install card and glass surfaces are locked to the
  design tokens.
- Ad geometry settled — leaderboard and in-content heights, responsive sizing,
  and an in-content banner that matches the download card width.
- Cookie-consent banner and preferences modal tightened across breakpoints.

### Fixed

- Instagram downloads proxied through the backend instead of yt-dlp.
- Galleries: unique filenames, correct photo media types, and explicit per-item
  buttons (the earlier zip/iframe approach was removed as unusable).
- Vercel installs: `pnpm-workspace.yaml` force-added (it was gitignored), pnpm
  version pinned, build-script approvals granted, and a root `vercel.json`
  added.
- The Docker image can start Cobalt: git installed and a real repository
  initialised so `version-info` can parse it.
- IP-locked CDN downloads, device font fallback, admin panel mobile overflow,
  ad-slot empty space, and the health/config endpoints that could 500.

## [0.1.0] - 2026-07-28

First usable release.

### Added

- FastAPI extraction backend: `POST /api/extract` with API-key auth and rate
  limiting, `GET /api/download` to stream the clean file, and health checks
  (`/api/health`, `/api/health/extract`).
- The complete Next.js frontend: single-page download flow, glass design system,
  cookie-consent banner with a preferences modal, and footer.
- Ad system with an admin panel — slot sizes with hints, creatives, a styled
  delete modal, and per-platform download statistics.
- Privacy-first site visit tracking with an admin traffic dashboard.
- Instagram downloader with a platform registry, so new platforms can be added
  without touching the flow.
- Product plan, content document, and a growth strategy from deep research.

### Changed

- Clean, human-readable filenames on the user's device.
- `glass-strong` surfaces fixed through tint opacity rather than extra blur,
  with a couple of blur passes to match the shipped design.
- A thin brand-coloured scrollbar on desktop.

### Fixed

- IP-locked CDN downloads, device font fallback, and an over-large cookie
  banner.
- `.env` loaded before the admin and Supabase configuration is read.
- `requirements.txt` pins synced with the verified deployment environment.
- Ad "Visit" badges no longer swallow clicks intended for the ad link.
- Single-page product structure (removed `/instagram`), admin panel mobile
  overflow, and the visits card.
- `IG_SESSIONID` URL-decoded, since browsers copy it percent-encoded.

[unreleased]: https://github.com/vip-ultr/tickless/compare/566c882...HEAD
[1.0.0]: https://github.com/vip-ultr/tickless/compare/1459cdb...566c882
[0.6.0]: https://github.com/vip-ultr/tickless/compare/1bf111a...1459cdb
[0.5.0]: https://github.com/vip-ultr/tickless/compare/ec7515d...1bf111a
[0.4.0]: https://github.com/vip-ultr/tickless/compare/2abd0d1...ec7515d
[0.3.0]: https://github.com/vip-ultr/tickless/compare/b2d6aac...2abd0d1
[0.2.0]: https://github.com/vip-ultr/tickless/compare/65632d0...b2d6aac
[0.1.0]: https://github.com/vip-ultr/tickless/commits/65632d0
