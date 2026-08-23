# Tickless Mobile App - Implementation Plan

> Status: Plan locked, pending user approval. No code until approved.
> Companion docs: `mobile-app-research.md` (why), `mobile-app-handoff.md`
> (resume for a fresh session).

## 1. Scope (locked)

- Expo / React Native app in `tickless/mobile/`, one codebase, Android + iOS.
- Reuses the existing FastAPI backend as-is (no backend changes for v1).
- Platforms: TikTok + Instagram only. YouTube dropped (backend cleanup deferred,
  app just never shows a YouTube entry point).
- Clip feature included, full scope.
- No store release. Deliverable: sideload APK for Android + Expo dev build for
  iOS. Base URL pointed at prod `https://tickless.onrender.com`.
- Design: top-class native feel, on-brand, size-watched.

## 2. Decisions (locked this session)

1. Layout: native-adapted (NOT a copy of the web scrolling page).
2. Tabs: 4 = **Download, Clip, About, More**.
3. Legal folded into **More** (Terms, Privacy, Copyright, DMCA + app info).
4. Android save: **"Tickless" album** in Gallery. iOS: Photos album.
5. Font: product family **Geist** (Sans + Mono), **respect device font size**.
6. Clip: **full** (paste link OR device upload, multi-segment, video + audio-only).
7. Repo: monorepo, new `mobile/` folder.
8. Notifications: in-app toasts only; push deferred.
9. API key handling (locked 2026-08-23): embed directly in the app config
   (`lib/config.ts`, same value as web NEXT_PUBLIC_API_KEY). Rationale: the
   key is already public via the web bundle; a proxy adds infra while hiding
   nothing from a decompiled APK anyway. Real protection later = per-install
   tokens / attestation behind accounts, out of scope for v1.
10. Offline clipping (locked 2026-08-23): v1 Clip is ONLINE-ONLY. Link clips can
   never be offline (media lives on TikTok/IG servers; trim is server-side).
   Device-upload clips also stay online in v1 because upload + server-side
   ffmpeg round-trip needs connectivity. UI must show an honest offline state
   ("clipping needs internet"). V2 CANDIDATE: on-device trimming via ffmpeg-kit
   ("clip with zero internet" differentiator), pending APK size measurement -
   ffmpeg-kit adds roughly 20-30MB per ABI vs the locked <30MB total budget,
   so it must be measured before commitment.

## 3. Tech stack

- Expo SDK (latest stable at build; RE-VERIFY version), New Architecture, Hermes.
- Expo Router (file-based, bottom tabs).
- Reanimated, expo-media-library, expo-file-system, expo-haptics,
  expo-font, expo-constants, expo-document-picker (or image-picker), expo-video
  (RE-VERIFY), expo-secure-store, lucide-react-native.
- No state library, no UI kit.

## 4. Repo layout (`tickless/mobile/`)

```
mobile/
  app/
    _layout.tsx            # root: theme provider, fonts, bottom tabs
    (tabs)/
      _layout.tsx          # bottom tab bar (Download, Clip, About, More)
      index.tsx            # Download screen
      clip.tsx             # Clip screen
      about.tsx            # About screen
      more.tsx             # More: FAQ + Legal links + app info
    more/
      faq.tsx
      legal/
        _layout.tsx
        terms.tsx
        privacy.tsx
        copyright.tsx
        dmca.tsx
    components/
      Downloader.tsx       # paste input + extract + state machine
      ResultCard.tsx       # thumb/title/author/duration/platform + controls
      GalleryChips.tsx     # Photo N / Video N selector
      ClipEditor.tsx       # timeline scrubber + segment list + export
      AdBanner.tsx         # native ad slot (reuses /api/ads)
      Toast.tsx            # in-app notifications
      ui/                  # GlassCard, Button (green), Input, Skeleton, Tabs
    lib/
      api.ts               # extract/download/clip clients + types
      config.ts            # API_URL, API_KEY, brand tokens
      types.ts             # ExtractResult, etc. (mirror backend JSON)
      haptics.ts
    assets/
      fonts/Geist*         # subset variable fonts
      icons/wordmark.svg    # "Tick" white + "less" green
  app.json / app.config.js # minSdk 24, iOS target, name "Tickless"
  eas.json                 # build profiles (android apk, ios dev)
```

## 5. Screen specs

### 5.1 Download tab (core)
State machine mirrors web Downloader + ResultCard:
- IDLE: paste input + green "Extract" button. Hint "Paste a TikTok or Instagram
  link". Hardening: reject >500 chars, non-supported host (call a local
  detect using the same host lists as backend `platforms.py`).
- LOADING: glass SkeletonCard (shimmer), not a spinner.
- RESULT (single): ResultCard = thumbnail, title, author, duration, platform
  badge. Controls: Download (selected), Download all (gallery), Audio (MP3,
  video only), GalleryChips when `gallery_types.length > 1`.
- RESULT (carousel/photo): chips drive which item downloads. No per-item buttons
  (matches web final state).
- SAVING: progress bar while bytes download + save to "Tickless" album. Success
  toast "Saved to your device". Android: request media-library permission on
  first save. iOS: save to Photos album.
- ERROR: inline card with backend message (ig_blocked, no_media, unavailable,
  unsupported). 503 "warming up" -> auto-retry once with a warming state.
- "Download another" = clear to IDLE, input persists.

### 5.2 Clip tab (full, port of web /clip)
- Source: paste TikTok/Instagram link OR pick video from device (max 500MB via
  document-picker). Show a preview with expo-video.
- Timeline scrubber (Reanimated): add multiple start/end segments; list them.
- Export each segment as video clip OR audio-only. App sends segments to
  `POST /api/clip` (mirror web ClipEditor request). Backend streams result; app
  saves via media-library.
- Lazy delivery matches web: trimmed on export, source parked server-side with
  TTL. Nothing persisted to Supabase.

### 5.3 About
Locked brand-story copy from `docs/content.md` (verbatim, same as web /about).

### 5.4 More
List screen: FAQ (links to faq.tsx), Legal (Terms/Privacy/Copyright/DMCA),
app version, save-location note ("Tickless" album). FAQ and Legal reuse the
locked web copy verbatim.

## 6. Backend API contract (reuse, from research.md Section 6)

- `POST /api/extract` `{url}` + `X-Tickless-Key` -> result JSON.
- `GET /api/download?url=&kind=&gallery_index=` + key -> streamed bytes.
- `POST /api/clip/upload` (file) + `POST|GET /api/clip` (segments).
- Handle 400/502/503 + 429 (slow down). Mirror web error copy.
- `lib/types.ts` models the exact response fields the web uses.

## 7. Brand / UI components

- `ui/GlassCard`: blur + 1px border + tint (same recipe as web glass-strong).
- `ui/Button`: solid green primary, blue accent variant.
- `ui/Input`: midnight field, green caret, mono font for the URL.
- `ui/Skeleton`: shimmer placeholder.
- Tokens in `lib/config.ts`: GREEN #A7E954, BLUE #1FD3E8, midnight bg, glass
  border. No gradients. Lucide icons only. No em-dashes in any copy.
- Respect device font size (do not lock RN text scale).

## 8. Ads
`AdBanner` calls `GET /api/ads?slot=` with the same key; maps leaderboard /
in-content / result to native placements; empty = nothing.

## 9. Notifications
In-app Toast only. `notifications/` stub left for future push. No store = no push.

## 10. Build config (size + breadth)

- `app.config.js`: `minSdk 24` (RE-VERIFY), iOS deployment target ~15+
  (RE-VERIFY), name "Tickless", icon = wordmark glyph.
- `eas.json`: `android-apk` profile (arm64-v8a, optionally armeabi-v7a);
  `ios-dev` profile for the dev build.
- Size budget: APK under ~30MB; measure after each feature, track in this doc.

## 11. Build phases (after approval)

- Phase M0: scaffold `mobile/`, Expo Router tabs, fonts, brand tokens, base URL.
  Verify it runs on a real phone (QR).
- Phase M1: Download tab full state machine + save to gallery + ads banner.
- Phase M2: Clip tab full (link + device upload + scrubber + export).
- Phase M3: About / More (FAQ + Legal) with locked copy.
- Phase M4: polish (motion, haptics, safe-area, a11y, size check) + build APK,
  install on Android, manual QA at 360/390/768px-equivalent and real iPhone.

## 12. Verification

- `npx expo start` on a real device (Android + iOS dev build).
- Build APK: `eas build -p android --profile android-apk`; sideload; confirm
  extract -> save works against prod Render (incl. IG warming retry).
- Clip: trim a link + a device video; confirm saved clips.
- Size: record APK size; confirm under budget.
- NOTE: no docker/WSL here, so backend is tested live against prod, not locally.
  Web tool outage means design trends were NOT live-verified; re-verify the
  RE-VERIFY items in research.md before final sign-off.

## 13. Deferred / out of scope

- App Store / Play Store publish (and therefore push notifications).
- YouTube in the app (backend still supports it; cleanup later if desired).
- Accounts, history, proxies, i18n.
