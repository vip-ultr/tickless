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

_Nothing yet._

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
