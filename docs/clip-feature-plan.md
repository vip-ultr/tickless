# Clip Feature Plan — Tickless

Manual video clipping integrated into the Tickless Python backend (Option B).
Standalone `/clip` page, multi-segment manual trim (same model as
my-video-clipper's editor), audio-only per segment. No AI, no Node, no Cobalt,
no new Supabase tables.

Status: PLANNED. Not yet built. This doc is the resumable handoff.

## Decisions (locked)

- **Backend shape**: Port into Tickless FastAPI backend. No separate Node service.
- **Scope**: manual trim + audio-only. NO subtitles, watermark, blur, aspect.
- **Source input**: URL (yt-dlp via existing `download_media`) AND local file upload.
- **Flow**: Flow A — standalone `/clip` route, Navbar "Clip" link.
- **Multi-clip**: one source, many start/end segments -> many clips (clipper model).
- **Delivery model**: LAZY — each clip's Download button triggers trim+stream on
  click. Source parked once under a token; no N output files stored; nothing
  persisted to Supabase; matches "we keep nothing".
- **File names**: default `<sourceTitle or "tickless-clip">_clip_<N>.{ext}`; user
  can override per-clip in the results list (filename only used at download time,
  never stored server-side). ext = mp4 (video) or mp3 (audio).
- **Temp storage**: source lives on Render's ephemeral disk only, under a token.
  - Upload mode: `/api/clip/upload` writes to a temp dir, returns token + duration.
  - URL mode: reuse existing `download_media` temp path.
  - Output segments: trimmed and streamed; never permanently stored.
  - TTL: 1 hour parked-source dir; background sweep deletes older dirs (mirrors
    clipper's 30-min cleanup job).
- **Caps**: upload limit 500MB (clipper used 1.5GB; too heavy for free tier).
  Rate limit + API key identical to `/api/extract`.

## Backend

New module `backend/clipper.py`:
- `trim_segment(src, start, end, out_path, audio_only)` -> runs ffmpeg as a
  subprocess arg-list (NOT a shell string; avoids the clipper's quote-breaking
  bug in burnSubtitles). `-ss/-to` for video; `-vn -acodec` for audio-only.
- Resolves source: if token -> parked file; if url -> `download_media(...)`.

New endpoints in `main.py` (same auth/rate-limit as `/api/extract`):
- `POST /api/clip/upload` (multipart) -> park file, return `{token, duration}`.
- `POST /api/clip` -> `{source_url | token, start, end, audio_only}` -> trim in
  threadpool -> StreamingResponse -> delete temp segment after.
- `GET /api/clip/health` or reuse `/api/health` (ffmpeg already in image).

Dockerfile: NO change (ffmpeg already installed). start.sh: NO change.

## Frontend (tickless design system)

- `frontend/src/app/clip/page.tsx` — standalone route, Navbar link added.
- Reuse existing `Navbar`, `Footer`, `AdSlot`, `ConsentBanner`, glass/btn-brand
  styling. Do NOT copy clipper's Next 14 UI.
- `frontend/src/components/ClipEditor.tsx`:
  - Zone 1 Source: tab "Paste link" | "Upload file".
    - Link: POST `/api/extract` -> fetch source -> show preview.
    - Upload: POST `/api/clip/upload` (multipart) -> show preview.
  - Zone 2 Editor: native `<video>` preview, start/end trim handles, mm:ss
    readouts, "selected: Ns", "Audio only" toggle, "Add clip" -> pushes
    {start,end,audioOnly} into in-browser segment list. "Play selection" previews.
  - Zone 3 Results: list Clip 1..N (range + type + editable filename + Download),
    "Download all" streams sequentially.

## Verify (real execution)

- Backend pytest (`test_clip.py`): seed a tiny local mp4 fixture, assert:
  - `/api/clip` (token) returns a valid trimmed file of the requested duration.
  - `audio_only` produces an audio-only file (no video stream).
  - multiple segments from one source each produce correct clips.
- Frontend: `pnpm build` + `pnpm lint` green.
- CI docker: boot image, hit `/api/clip` with a seeded fixture (only in CI;
  Docker unavailable locally).

## Out of scope (explicitly deferred)

- Subtitle/caption burn-in (needs transcript; can add "paste SRT" later).
- Watermark, blur, aspect-ratio edits.
- AI auto-detect (Whisper/HuggingFace) — dropped by decision.
- Supabase clip tables — not needed for lazy delivery.

## Build phases (for resuming)

1. Backend `clipper.py` + `/api/clip/upload` + `/api/clip`, with tests. [DONE]
2. Frontend `/clip` route + ClipEditor + Navbar link. [DONE]
3. CI green (build/lint/test/docker) + push. [DONE]
4. (Optional later) eager-generation mode, SRT captions.
