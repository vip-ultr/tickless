# Tickless Mobile App - Research

> Status: Research complete. No code written. This doc grounds the plan
> (`mobile-app-plan.md`) and the handoff (`mobile-app-handoff.md`).
>
> HONEST SOURCING NOTE: the web search / web extract tools were unavailable
> during this research pass (Nous Tool Gateway not entitled). The "2026 design
> language" and "Expo defaults" sections below are built from the current
> React Native / Expo ecosystem knowledge and platform design-system conventions
> as of mid 2026, NOT from freshly fetched articles. Every claim that depends on
> a live version number (Expo SDK default minSdk, iOS deployment target, exact
> bundle size) is flagged RE-VERIFY and must be confirmed at build time with
> `npx expo --version` / the Expo docs before it is treated as final.

## 1. Goal and constraints (locked)

- One codebase, runs on Android AND iOS via Expo (React Native).
- Reuse the EXISTING backend as-is. The mobile app is a second client of
  `/api/extract` and `/api/download` (and `/api/clip`), exactly like the web
  frontend. No backend changes for v1.
- Platforms in the app: TikTok + Instagram ONLY. YouTube is dropped per user
  decision. NOTE: the backend `platforms.py` still registers `youtube` and
  `main.py` still wires YouTube extraction. The app simply will not surface a
  YouTube path. Flagged for later backend cleanup, not a mobile blocker.
- Clip feature (`/clip`) IS included, full scope, ported from the web.
- No App Store / Play Store release yet. Deliverable for now: an APK the user
  sideloads on Android, plus an Expo dev build for iOS testing (Apple does not
  allow sideload without a store or enterprise cert).
- Design bar: must feel "top-class, like big-company apps of late 2026".
- App size must be watched from day one (user requirement).

## 2. Framework choice (locked)

- **Expo (React Native)** with the **New Architecture** (Fabric renderer,
  TurboModules) and **Hermes** engine. This is the current React Native default
  and gives near-native smoothness with a single JS codebase for both OSes.
- **Expo Router** for navigation: file-based, mirrors the web's Next.js App
  Router mental model, so the repo stays consistent and there is less custom
  navigation code. Bottom tab layout is first-class in Expo Router.
- Development/testing: run on a real phone via Expo Go or a development build
  (QR code). No store, no paid account needed to develop or test.
- Release build: `eas build -p android` produces an `.apk` (or `.aab`) we
  sideload. iOS `eas build -p ios` needs Apple infrastructure, which EAS cloud
  provides; we do NOT need a local Mac. iOS store publish is deferred.

## 3. What "top-class late-2026 mobile" means (RE-VERIFY design trends live)

Synthesised from current platform design systems (Material You / Dynamic Color
on Android, Human Interface Guidelines + Liquid Glass on iOS) and shipping
React Native products. The tells that separate professional from template:

1. **Restrained, confident motion.** 200-300ms spring transitions, not bouncy.
   Shared-element / cross-fade between list and detail. Use Reanimated for the
   scrubber and subtle press states. Motion with restraint (user rule).
2. **Real depth, not fake shadows.** Subtle elevation, glass only where it
   earns it. Already locked: glass cards, no gradients. Keep glass on key
   surfaces (result card, bottom sheet, nav) and nowhere else.
3. **One excellent type system, device-scaled.** Self-host the product font
   (Geist Sans + Geist Mono) but RESPECT the device font-size setting
   (Android font scale, iOS Dynamic Type). Big apps do not force their own size;
   they honor the OS. RN Text scales with the OS by default unless disabled, so
   we keep that behavior. (Locked: product family + device font size.)
4. **Accessible, dark-first, WCAG AA contrast.** We are already midnight/dark.
   Verify green #A7E954 on midnight passes AA for text/controls.
5. **Bottom tab bar**, icon + label, large touch targets (min 44pt / 48dp),
   safe-area aware (notch, gesture bar, status bar). This is the native-adapted
   nav that replaces the web's bottom-sheet menu.
6. **Haptic feedback** on key actions (extract, save, segment add) via
   expo-haptics. Small detail, large premium feel.
7. **Anti-AI-template rules (locked, same as web):** no emoji-as-icon, no
   centered-lonely-CTA, no purple-gradient cliche, specific copy, no em-dashes,
   Lucide icons only, asymmetric spacing, intentional rhythm.

## 4. Android version breadth (user concern: many Android versions)

- Expo's default `minSdk` currently ships at 24 (Android 7.0, 2016). That already
  covers roughly 99% of active devices. RE-VERIFY the exact default at build
  time; do NOT raise it.
- Plan: `minSdk 24`, compile against current. This lets Android 7 through the
  latest install. Avoid libraries that force `minSdk 26+` unless required; if a
  dep demands higher, note it and find an alternative.
- iOS deployment target: Expo default ~iOS 15/16. Since no store release now,
  this only affects the dev build; set reasonably (iOS 15+) and document.
  RE-VERIFY exact default at build.

## 5. App-size discipline (user concern: do not ship bloated)

What big teams do, and what we will do:

1. New Architecture + Hermes (smaller runtime, faster) - default in current RN.
2. **Minimal dependency surface.** Every added library costs size. Audit the
   list (Section 7). No full UI kit (we build brand components) to avoid bloat
   and stay on-brand.
3. **Vector icons only** (font-based, tiny) via lucide-react-native. No raster
   icon packs.
4. **Single variable font, subset.** Geist Sans + Geist Mono, loaded via
   expo-font, only the weights we use (400/500/600/700). Wordmark is a small
   vector/SVG, not a font render, where possible.
5. **Measure after each major feature.** Build the APK and check size; keep a
   running budget. Target: tool-app APK under ~30MB (Expo Hermes baseline is
   typically 15-25MB). Track in the plan; fail the build locally if it balloons.
6. For sideload we produce an `arm64-v8a` (and optionally `armeabi-v7a`) APK,
   not a universal blob, to keep the delivered file small. AAB is for store later.
7. RN has no web-style code-splitting; instead we keep screens modular and avoid
   pulling unused modules into the bundle.

## 6. Backend contract the app reuses (read from repo, factual)

Base URL: `https://tickless.onrender.com` (prod). Auth: header
`X-Tickless-Key` (same value as web `NEXT_PUBLIC_API_KEY`). Rate limit: 10 req/
min/IP on extract/download/clip (handle HTTP 429 with a friendly "slow down").

- **POST /api/extract**  body `{url}`  header `X-Tickless-Key`
  Response (success): `{title, author, duration, thumbnail, video_url,
  audio_url, width, height, platform}` plus optional `gallery`,
  `gallery_types`, `photo_urls` for carousels/photos.
  Errors: 400 (unsupported / no_media / ig_blocked / unavailable-region),
  502 (extract_failed), 503 (extractor_waking, Retry-After:30 -> auto-retry
  once with a "warming up" state). Error body is `{detail: "<message>"}`.
- **GET /api/download**  `?url=&kind=video|audio&gallery_index=`  header or
  `?key=`. Streams the file as an attachment with a `Content-Disposition`
  filename. Native fetch receives the bytes; we save via media-library. (TikTok
  CDN is IP-locked, so the backend streams it - same as web, do not redirect.)
- **POST /api/clip/upload**  multipart `file` (max 500MB) parks the source.
  **POST|GET /api/clip**  body with segments trims and streams the result. The
  web Clip page is the reference for the exact request shape; port it.

CORS note: CORS is a browser concept. A native Expo fetch sends no `Origin`
(and is not a browser), so the backend's Vercel-locked CORS allow list will not
block it. RE-VERIFY with a real device call; if Render rejects, we add the app's
origin or a dev bypass (not expected).

## 7. Minimal dependency set (size-aware)

Required:
- expo, react, react-native (New Arch, Hermes)
- expo-router (file-based nav, bottom tabs)
- react-native-reanimated (motion, clip scrubber)
- expo-media-library (save to gallery/photos)
- expo-file-system (download streamed bytes to cache, then save)
- expo-haptics (feedback)
- lucide-react-native (icons)
- expo-font (Geist), expo-constants (env/config)
- expo-document-picker or expo-image-picker (device video for Clip)
- expo-video (clip preview scrubber) - RE-VERIFY current recommended player
- expo-secure-store (hold API key; optional, web already exposes it)

Deliberately avoided (bloat / off-brand):
- No Redux / state library (React state + a small context is enough)
- No full component kit (build brand components)
- No heavy chart/animation bundles

## 8. Notifications

- **In-app only for v1:** toasts/snackbars for save success, errors, "warming
  up" retry. No OS push needed.
- **Push DEFERRED.** Push needs store credentials and a server, so it is out of
  scope while we do not ship to stores. The architecture leaves a clean seam
  (a `notifications/` module stub) so it can be added later without rework.
- Background: if the app is backgrounded mid-download, the API call completes
  and we show the final state on return. No background-fetch complexity in v1.

## 9. Ads (reuse backend)

- `GET /api/ads?slot=` already exists. Map web slots to native placements:
  leaderboard -> slim banner above/below the result card (labeled "Ad");
  in-content -> native ad card between input and result on first load;
  result -> ad card below the saved result.
- Empty slot renders nothing (zero footprint), same as web AdSlot rule.

## 10. Brand mapping (locked, same as web)

- Background: midnight. Cards: glass (blur + 1px border + tint). No gradients.
- Primary = green #A7E954 (buttons, highlights, active tab, input caret).
- Accent = blue #1FD3E8 (secondary only).
- Wordmark: "Tick" white + "less" green, in the tab header / app icon.
- Icons: lucide-react-native only.
- Copy: no em-dashes, digits for quantities, same specific copy as web.
- Respect device font size (Section 3.3).

## 11. Open risks to confirm at build time (RE-VERIFY)

1. Exact Expo SDK default `minSdk` and iOS deployment target.
2. Current recommended video player lib for the Clip scrubber (expo-video vs
   react-native-video).
3. Real-device call to Render passes CORS/origin expectations.
4. Actual APK size after first build; set the budget number then.
5. Geist font license/availability for app embedding (it is open source, but
   confirm the package we pull).
