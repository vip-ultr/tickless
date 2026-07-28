# Plan: multi-platform Tickless (TikTok + Instagram, extensible)

Written 2026-07-28. Status: APPROVED PENDING BUILD.
Goal: one input box, auto-detect platform from the pasted link, download Instagram Reels/videos exactly like TikToks. Architecture must make adding platform number 3 (YouTube Shorts, Facebook, X...) a config change, not a rewrite. Admin gains per-platform download counters.

## 0. Locked decisions

1. Same single input. No platform picker. Backend detects platform from hostname and reports it back; frontend adapts labels dynamically.
2. yt-dlp remains the only extractor (it supports Instagram natively). No new dependencies.
3. Platform registry pattern: one PLATFORMS dict in backend/platforms.py is the single source of truth (hosts, display name, error strings key). Everything else reads from it.
4. Instagram scope v1: Reels and feed videos (single). Stories, private posts, carousels/multi-image = clean "not supported yet" errors. IG photos = same treatment as TikTok slideshows.
5. Instagram extraction risk: IG is more aggressively anti-bot than TikTok. yt-dlp handles public Reels without login today; if IG starts demanding login we show a clear error, never ask users for credentials.
6. Downloads counter lives in Supabase (new downloads table), counted server-side in /api/download success path only (a real completed file stream, not extract calls).
7. Copy changes sitewide: "TikTok" as the sole subject becomes "TikTok and Instagram" (hero, FAQ, about, legal, metadata). Wordmark and brand unchanged. No em dashes.
8. SEO: single-page product per user decision. No /instagram subpage; the homepage carries both platforms.

## 1. Backend changes

### 1.1 New: backend/platforms.py
- PLATFORMS = {"tiktok": {...}, "instagram": {...}} with: display name, allowed hosts set, url path hints, filename fallback noun.
- detect_platform(host) -> str | None helper.
- Hosts for instagram: instagram.com, www.instagram.com, m.instagram.com, instagr.am. Path must contain /reel/, /reels/, /p/, /tv/ or /share/ for validity.

### 1.2 validation.py
- normalize_and_validate(raw) -> tuple[str, str] now returns (clean_url, platform).
- Error codes get platform-neutral: "unsupported" replaces "not_tiktok" (keep "not_tiktok" as alias in ERROR_MESSAGES during transition).
- Blocklist stays: max length, scheme forcing.

### 1.3 extractor.py
- extract(url) and download_media(...) unchanged in signature except they receive platform for error mapping; yt-dlp options mostly shared.
- Instagram specifics: no watermark concept (IG files are clean already), thumbnail/title/uploader map the same. Retry logic stays (works for IG flakiness too).

### 1.4 main.py
- ERROR_MESSAGES: neutral copy. "Paste a TikTok or Instagram link to get started.", "That does not look like a TikTok or Instagram link." etc.
- /api/extract response gains "platform": "tiktok" | "instagram" so the frontend can adapt.
- /api/download: after successful stream start, fire-and-forget record_download(platform) to Supabase (same graceful no-op pattern as visits).
- build_download_filename unchanged (uploader - title - Tickless.ext works for both).

### 1.5 analytics.py + supabase_schema.sql
- New table downloads: id, platform text, kind text (video/audio), day date, count via one row per platform+kind+day with counter (same compact pattern as visits).
- record_download(p_platform, p_kind) upsert function.
- download_stats() function: totals per platform (today/7d/30d/all-time) for the admin.
- GET /api/admin/downloads (JWT) returning that JSON.

### 1.6 Tests
- Unit: detect_platform for all host variants (vm.tiktok.com, instagr.am, share links, negative cases: youtube, garbage).
- Unit: validation returns correct platform tuple.
- Live (marked flaky-tolerant like the TikTok one): extract a public IG Reel.
- Existing 14 tests must keep passing.

## 2. Frontend changes

### 2.1 Downloader.tsx
- Placeholder: "Paste a TikTok or Instagram link".
- Result state uses platform from the API response (icon + "TikTok video" / "Instagram reel" label in ResultCard).
- Error copy comes from backend, already neutral.

### 2.2 New page: /instagram
- Same Downloader component, Instagram-first copy: H1 "Instagram Video Downloader", hero, 3-step HowTo, Instagram FAQ block (reels, no watermark framing, private accounts answer, is it legal answer).
- Linked from footer + homepage ("Also works with Instagram Reels" line under the hero).

### 2.3 Copy updates (site-wide sweep)
- page.tsx hero: keep locked TikTok copy line but extend: subject becomes both platforms where it reads naturally.
- faq/page.tsx: add 3 Instagram Q&As, adjust "TikTok only" phrasing.
- about/page.tsx: "TikTok and Instagram, more platforms coming".
- terms/privacy/copyright: replace "TikTok" with "supported platforms (TikTok, Instagram)" where it constrains scope.
- layout.tsx metadata: title "Tickless - TikTok & Instagram Video Downloader, No Watermark". OG description updated.
- sitemap.ts: add /instagram.

### 2.4 Admin page
- New "Downloads" stat section beside Site traffic: per-platform cards (TikTok / Instagram), each showing today, 7d, 30d, all-time; video vs audio split shown as secondary line.
- Types + fetch from /api/admin/downloads, same silent-failure pattern as visits.

## 3. Docs updates
- docs/product-plan.md: locked decision addendum (platform registry, IG scope v1).
- docs/content.md: append Instagram page copy + updated shared copy (the doc stays source of truth).
- This plan file lives at docs/instagram-plan.md, updated as built.

## 4. Build order (each step verified before the next)

1. backend platforms.py + validation refactor + unit tests (no behavior change for TikTok).
2. extract/download platform plumbing + IG live test. Verify real IG Reel end to end locally (header, file, filename).
3. downloads schema + record + admin endpoint + tests. USER ACTION: run new SQL in Supabase.
4. Frontend: Downloader copy + platform in ResultCard.
5. /instagram page + sitemap + footer link.
6. Site-wide copy sweep (per docs/content.md updates first).
7. Admin downloads section.
8. Full verification: pytest, tsc, eslint, next build, local e2e both platforms, then push (Render + Vercel auto-deploy), live e2e.

## 5. Risks / notes
- IG rate-limits datacenter IPs harder than TikTok; Render's shared IP may hit login walls. Mitigation: clear error message ("Instagram is blocking our server right now, try again in a few minutes"), monitor via health cron later.
- IG carousels (multi-video posts) are a playlist in yt-dlp; v1 downloads the first entry and we note it in FAQ.
- Copy rule: no em dashes anywhere, quantities as digits.
- Nothing in this plan requires the custom domain decision; it stacks cleanly on the growth strategy later.
