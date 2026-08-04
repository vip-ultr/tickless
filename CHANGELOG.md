# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Instagram cold-start 502: the backend no longer fire-and-forgets a single ping
  to the Cobalt service. `cobalt_client._warm_up_cobalt()` now POLLS Cobalt until
  it actually responds (budget `COBALT_WARMUP_BUDGET`, default 55s; interval
  `COBALT_WARMUP_INTERVAL`, default 3s), which safely covers Render free-tier's
  measured ~23s cold boot. The first Instagram download after idle now waits for
  Cobalt to wake instead of failing with `extractor_down` (no more manual redeploy).
- Instagram error mapping: Cobalt returns structured errors as HTTP 400
  (e.g. `error.api.fetch.empty` for the login wall). The backend now parses that
  body and maps it to the canonical `no_media` message ("we could not find a
  downloadable video") instead of a generic "something went wrong", so the
  Instagram login wall is reported cleanly rather than as a server error.
- Test isolation: added `backend/conftest.py` so the suite is order-independent.
  yt-dlp's plugin loader can rebind `sys.modules['extractor']` to
  `ytdlp_plugins.extractor` mid-session; a meta-path finder plus an autouse
  fixture keeps the local `extractor` module pinned so `cobalt_client` imports
  resolve correctly regardless of test order.

### Changed
- `/api/extract` Instagram branch now runs `cobalt_extract` in the threadpool
  (was blocking the event loop). A cold-start warmup can block for up to
  `COBALT_WARMUP_BUDGET` (~55s), which would otherwise freeze TikTok extraction
  and health checks for the same user.
