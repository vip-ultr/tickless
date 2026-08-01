# Changelog

All notable user-facing changes to Tickless are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-08-01

### Added
- Professional Terms of Use, Privacy Policy, Copyright, and DMCA takedown pages.
- `docs/legal-posture.md` describing how the project handles platform and legal risk.
- `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `NOTICE`, and `CHANGELOG.md`.
- Frontend `.env.example` for local setup.
- GitHub Actions CI that builds and lints the frontend on every push and pull request.

### Changed
- Removed YouTube from frontend copy, metadata, and the downloader. Backend
  extraction for YouTube remains available.
- Rewrote the README to a modern, structured format.

### Fixed
- Instagram 502 on Render cold start via Cobalt warm-up and retry.
- Instagram `error.api.fetch.empty` returns a clean no-media (400) instead of 502.
- YouTube bot-wall handled via a cookie-less PO-token provider.
- Per-device ad creatives (desktop and mobile) with fallback.

[Unreleased]: https://github.com/vip-ultr/tickless/commits/main
[1.0.0]: https://github.com/vip-ultr/tickless/releases/tag/v1.0.0
