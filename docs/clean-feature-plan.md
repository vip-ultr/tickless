# Clean Feature Plan — Tickless

> **Status:** **BUILT, NOT YET SHIPPED.** Code is in the tree at `/clean`;
> awaiting verification run before release.
> **Written:** 2026-09-29 · **Last updated:** 2026-09-29
> **Record of what changed after this lands:** [CHANGELOG.md](../CHANGELOG.md)

Strips AI provenance metadata from a file the user uploads: C2PA / JUMBF
Content Credentials, the IPTC "made with AI" source type, AI prompt fields,
PNG generation recipes, and recorded edit history. Standalone `/clean` page in
the same shape as `/clip`. No new service, no new Supabase tables.

This is a *metadata* tool. It does not touch pixels or audio, and the copy says
so on the page itself.

## Decisions (locked)

- **Backend shape**: new module `backend/cleaner.py` inside the existing FastAPI
  app. No separate service, matching the clip decision.
- **Scope**: AI-only mode only. There is deliberately no "remove everything"
  switch. Camera EXIF, GPS, copyright and the ICC profile all survive.
- **Engine**: ExifTool (`libimage-exiftool-perl` in the Dockerfile). It is the
  one tool that understands the JUMBF container across JPEG, PNG, WebP, HEIC,
  AVIF, MP4 and MOV from a single command line. Mutagen covers MP3.
- **Flow**: standalone `/clean` route, Navbar "Clean" link, between Clip and FAQ.
- **Delivery model**: one request. Upload is read, cleaned into a temp dir,
  streamed back with the counts in response headers, and deleted. Nothing is
  parked, nothing is persisted, no token round-trip. This is *stricter* than
  `/clip`, which parks a source for an hour, because Clean needs no second visit.
- **Caps**: 200 MB per upload (`cleaner.MAX_CLEAN_BYTES`), 10/minute rate limit,
  same API key check as `/api/extract`.
- **Formats**: mp4, mov, m4v, jpg, jpeg, png, webp, heic, heif, avif, mp3, m4a.
- **Framing**: privacy and file hygiene, not "beat AI detection". The page
  carries an explicit *What it does not remove* panel. See Legal framing below.

## The three traps this was built around

All three were found by running the real binary rather than trusting
documentation. They are why `backend/cleaner.py` looks the way it does.

### 1. ExifTool silently accepts flags that do not exist

The AI-only command published by exifreader.com, which is the most-cited
recipe for this task, is:

```
exiftool -JUMBF:all= -C2PA:all= -PNG:parameters= -PNG-text:parameters= \
  -XMP:prompt= -XMP:negativeprompt= -XMP:aiprompt= -XMP:cfgscale= -XMP:steps= \
  -XMP:sampler= -XMP:scheduler= -XMP:lora= -XMP:controlnet= -XMP:vae= \
  -CBOR:all= -overwrite_original image.png
```

Tested against real builds (12.76 from Debian, 13.59 from git), **only three of
those sixteen flags are valid**: `-JUMBF:all=`, `-PNG:parameters=` (13.59 only,
rejected by 12.76), and nothing else. `-C2PA:all=` and `-CBOR:all=` answer
`Not a deletable group`. Every `-XMP:*prompt/cfgscale/steps/sampler/lora/
controlnet/vae` answers `Tag ... is not defined`.

ExifTool **downgrades an invalid flag to a warning and still exits 0** as long
as one other flag in the same invocation is valid. So the published command
appears to succeed while doing almost nothing beyond the JUMBF removal.

Consequences for us:

- `AI_STRIP_FLAGS` contains only names verified against `exiftool -listx` and
  against real C2PA files.
- `test_ai_strip_flags_are_only_verified_names` is a regression guard that
  fails if one of the known-bad names comes back.
- The correct XMP target is `-XMP-iptcExt:all=`, because `DigitalSourceType`
  lives in the **iptcExt** family. `-XMP-dc:DigitalSourceType=` fails even
  though the name looks right.

The verified portable command, working on both 12.76 and 13.59:

```
exiftool -JUMBF:all= -PNG:all= \
  -XMP-iptcExt:all= -XMP-xmpMM:History= -XMP-photoshop:History= \
  -overwrite_original FILE
```

### 2. Exit code 0 is not proof of removal

ExifTool returns 0 on GIF while removing nothing at all (verified: JUMBF line
count 51 before, 51 after, `c2patool` still reports the manifest Valid).

`strip_ai()` therefore does not trust the exit code. It re-reads the output and
asserts `_jumbf_count(out) == 0`, raising `CleanError` if the block survived.

### 3. MP3 cannot be written by ExifTool at all

```
Error: Writing of MP3 files is not yet supported
```

C2PA in MP3 also is *not* JUMBF: it is an ID3v2 GEOB frame with MIME
`application/c2pa`, which ExifTool cannot write (though it can read it for
inspection, which is what `cleaner._id3_has_c2pa` uses).

Two candidate writers were measured against the same C2PA MP3 (22370 bytes,
13717-byte GEOB payload), with the decoded audio MD5 taken before and after:

| approach | C2PA gone | audio | other ID3 tags |
| --- | --- | --- | --- |
| FFmpeg `-map_metadata -1 -c:a copy` | yes | identical | **wiped** (Title/Artist/Album lost) |
| mutagen GEOB delete | yes | identical | **preserved** |

FFmpeg is one line and it works, but it takes every user tag with it, which
directly contradicts AI-only mode's promise to touch nothing but the AI layer.
**mutagen is the chosen path**, and `test_mp3_strips_geob_and_keeps_user_tags`
is the test that keeps that distinction from regressing.

Two mutagen details that cause silent failures if missed:

- The GEOB attributes are lowercase (`mime`, `desc`). The capitalized
  `MimeType` / `Desc` that examples online use do not exist, so a filter
  written that way matches nothing, deletes nothing, and reports success on an
  uncleaned file.
- `tags.save(v2_version=...)` should follow the file's existing tag version
  (`tags.version`) rather than forcing one.

## What it deliberately does not do

- **No pixel or watermark work.** Google SynthID (mandatory on Veo output, in
  both video frames and the audio track), Meta Video Seal, and forensic
  statistical fingerprints live in the media data. No metadata tool reaches
  them. Removing them would mean re-encoding every frame, which is a different
  product with a real quality cost.
- **No "undetectable" claim.** Every credible tool in this space carries the
  same disclaimer, and a clean result is not evidence of anything.
- **No GIF, PDF, or WebM.** GIF exits 0 without removing anything, so it is
  rejected rather than silently passed through. PDF is read-only for C2PA in
  ExifTool.

## Legal framing

Stripping metadata from a file you hold is legal and ordinary. What differs is
how it is *described*.

The EU AI Act and the US NO FAKES Act are moving toward **requiring**
machine-readable provenance rather than permitting its removal, and several
tools in this space (UnMark, RemoveAILabel) explicitly carve out the
"pass AI content off as human-made" use case. Tickless already has a founder-level
[legal posture](./legal-posture.md), so the copy here is written to sit inside it:

- Sold as **file hygiene and privacy**, alongside the existing no-watermark pitch.
- The page states what it cannot remove, in a panel that is always visible, not
  tucked into an FAQ.
- No copy implies defeating platform detection or AI disclosure requirements.

If this feature ever gets marketing copy of its own, `docs/content.md`
section 11 is the source of truth and its copy rules (no em-dashes, no
AI-filler phrases) apply.

## Backend

`POST /api/clean` — multipart upload, returns the cleaned file.

| Concern | Where |
| --- | --- |
| Strip logic, format table, flags | `backend/cleaner.py` |
| Route, size cap, header contract | `backend/main.py` (`api_clean`, `CLEAN_MESSAGES`) |
| ExifTool in the image | `backend/Dockerfile` (`libimage-exiftool-perl`) |
| Tests | `backend/test_clean.py` |

Response headers the frontend reads:

| Header | Meaning |
| --- | --- |
| `X-Clean-Removed` | number of metadata tag lines removed |
| `X-Clean-Had-AI` | `1` if anything was there to remove |
| `X-Clean-Signals` | comma-separated human labels, ASCII-sanitized |

All three are in the CORS `expose_headers` list, or a cross-origin `fetch`
cannot read them.

Counts only, never values: `inspect()` reports how many tags exist per group,
not what they say. A prompt is user data and has no business in a log line.

## Frontend

| Piece | Where |
| --- | --- |
| Drop zone, states, panels | `frontend/src/components/CleanTool.tsx` |
| Route, meta, hero | `frontend/src/app/clean/page.tsx` |
| Nav link (between Clip and FAQ) | `frontend/src/components/Navbar.tsx` |

States: idle -> ready -> working -> done, with error reachable from any. The
cleaned file becomes a blob URL in the browser; the server has already deleted
its copy by the time the response finishes. `URL.revokeObjectURL` happens in a
single `useEffect` cleanup, deliberately not inside a `setState` updater (React
may run updater functions twice under StrictMode).

The Download control is a real `<a href={blobUrl} download>`, not a
fetch-then-click. `/clip` hit exactly that problem: the programmatic click lands
outside a user gesture and the browser silently drops it.

## Verified format matrix

Every cell measured against a real C2PA file (built with `c2patool`) on **both**
ExifTool 12.76 (Debian package) and 13.59 (git), twice over: `rc=0`, stdout
`1 image files updated`, **empty stderr with zero `Warning:` lines**,
`c2patool` reporting `No claim found` afterwards, and a byte scan for
`c2pa|jumb` coming back empty.

| Format | Command | JUMBF before -> after | Size before -> after | Integrity |
| --- | --- | --- | --- | --- |
| JPEG | ExifTool | 51 -> 0 | 125007 -> 62462 | PIL opens |
| PNG | ExifTool | 51 -> 0 | 353478 -> 290177 | PIL opens |
| WebP | ExifTool | 51 -> 0 | 14922 -> 88 | PIL opens |
| MP4 | ExifTool | 46 -> 0 | 26175 -> 12337 | ffmpeg decodes, h264+aac |
| MOV | ExifTool | 46 -> 0 | 26232 -> 12380 | ffmpeg decodes, h264+aac |
| HEIC | ExifTool | 46 -> 0 | 14246 -> 407 | pillow-heif opens |
| AVIF | ExifTool | 46 -> 0 | 14160 -> 321 | PIL opens |
| MP3 | mutagen | GEOB frame deleted | 22370 -> 9662 | audio MD5 identical |

13.59 and 12.76 produced byte-identical output sizes for every format.

**FFmpeg alone also works for MP4/MOV** (`-map_metadata -1 -fflags +bitexact
-c:v copy -c:a copy`, JUMBF 46 -> 0), which would have saved a dependency. It
is not used, because it also erases unrelated container metadata and zeroes the
dates, and AI-only mode promises to keep everything that is not the AI layer.

**AVIF's exit 1 was a false alarm.** The single rc=1 seen during round 1 does
not reproduce: 12/12 fresh C2PA AVIFs returned rc=0 across both builds. The
rc=1 cases are all environmental and are worth knowing about because they are
what a race looks like:

```
Error: Temporary file already exists: target.avif_exiftool_tmp~
Error: File not found - /path/nope.avif
Error: Error creating file: rodir/f.avif_exiftool_tmp - rodir/f.avif
```

ExifTool writes `FILE_exiftool_tmp` beside its output. Each request here gets
its own `tempfile.mkdtemp()` workdir, so two concurrent cleans cannot collide,
but anything ever added that shares a directory must not strip the same path
twice at once.

## Verification

Run from `backend/`:

```bash
uv run pytest test_clean.py -v
```

Tests that need ExifTool, FFmpeg or mutagen SKIP when the dependency is absent,
matching the `test_clip.py` convention, so the API-shape and copy-rule tests
run everywhere.

## Open questions

- **None blocking.** The two that were open when this was first written are
  settled: MP3 goes through mutagen (proven to preserve user tags while
  removing the frame), and AVIF is reliably supported (the earlier exit 1 was
  a concurrent-write race, not a format limitation).
- **Worth a live check before announcing:** behaviour on a real-world C2PA
  asset rather than a `c2patool`-built one, particularly a Pixel-captured
  photo, since Pixel is the main mainstream camera shipping C2PA.
