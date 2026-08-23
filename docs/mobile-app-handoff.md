# Tickless Mobile App - Fresh-Session Handoff

> Read this first if you are a new session continuing the mobile app. The web
> product skill (`tickless-maintenance`) still applies for the backend; this
> handoff covers ONLY the new `mobile/` app.

## What is decided (do not re-litigate)
- Expo / React Native app in `tickless/mobile/`, one codebase, Android + iOS.
- Reuses the existing FastAPI backend AS-IS. No backend changes for v1.
- Platforms in the app: TikTok + Instagram ONLY. YouTube dropped (backend still
  registers youtube; app never shows it). Do not add YouTube UI.
- Clip feature: FULL (paste link OR device upload, multi-segment, video +
  audio-only). Backend endpoints: POST /api/clip/upload, POST|GET /api/clip.
- No store release. Deliverable: sideload APK (Android) + Expo dev build (iOS).
  Base URL = https://tickless.onrender.com.
- Tabs (4): Download, Clip, About, More. Legal (Terms/Privacy/Copyright/DMCA)
  folded into More.
- Android save = "Tickless" album in Gallery. iOS = Photos album.
- Font = Geist (product family) + respect DEVICE font size. No forcing app size.
- Notifications = in-app toasts only. Push DEFERRED (needs store).
- Brand locked: green #A7E954 primary, blue #1FD3E8 accent, midnight glass, NO
  gradients, Lucide icons only, no em-dashes, digits for quantities. Same anti-
  AI-template rules as the web.
- App size watched from day one; target APK under ~30MB; measure per feature.

## Key backend contract (reuse)
- POST /api/extract {url} + header X-Tickless-Key -> result JSON
  {title, author, duration, thumbnail, video_url, audio_url, width, height,
  platform, [gallery], [gallery_types], [photo_urls]}.
- GET /api/download?url=&kind=video|audio&gallery_index= + key (header or ?key=)
  -> streamed file bytes (save via media-library, do NOT redirect).
- Errors: 400/502/503 (+503 extractor_waking -> auto-retry once), 429 slow down.
- CORS is browser-only; native fetch should pass. Verify on a real device.
- Rate limit 10/min/IP on extract/download/clip.

## Research caveats (IMPORTANT)
Web tools were down when research was written. The "2026 design" and Expo
defaults are from knowledge, NOT live sources. RE-VERIFY before final sign-off:
Expo SDK default minSdk + iOS target, recommended video player lib for Clip,
real-device CORS pass, actual first-build APK size, Geist embedding license.

## Where things live
- Plan: docs/mobile-app-plan.md
- Research: docs/mobile-app-research.md
- This handoff: docs/mobile-app-handoff.md
- Backend reference (web skill): ~/.hermes/skills/web-development/tickless-maintenance
- Web copy source of truth: docs/content.md (use verbatim for About/FAQ/Legal)

## Next step after approval
Phase M0 (scaffold mobile/, Expo Router tabs, fonts, tokens, base URL; run on a
real phone). Then M1 Download, M2 Clip, M3 About/More, M4 polish + APK build +
manual QA. Do NOT write code until the user approves the plan.

## Commands (run inside tickless/mobile after scaffold)
- Dev on device: `npx expo start` (scan QR with Expo Go / dev build)
- Android APK: `eas build -p android --profile android-apk`
- iOS dev build: `eas build -p ios --profile ios-dev`
- Type check: `npx tsc --noEmit`
- Lint: `npx expo lint`
