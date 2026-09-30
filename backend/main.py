"""Tickless backend - FastAPI app.

Endpoints:
  GET  /api/health            -> liveness
  GET  /api/health/extract    -> deep check (runs a real extraction)
  POST /api/extract           -> extract clean TikTok media (auth + rate limited)
"""
import logging
import os
import re
import shutil
import tempfile
import unicodedata
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse, StreamingResponse

import httpx
from extractor import ExtractionError, download_media, extract
from cobalt_client import cobalt_extract
from cleaner import (
    MAX_CLEAN_BYTES,
    CleanError,
    extension_of,
    strip_ai,
    SUPPORTED_EXTS,
)
from validation import normalize_and_validate
from ads import router as ads_router
from analytics import router as analytics_router, record_download
from clipper import (
    park_upload,
    source_path_for_token,
    trim_segment,
    ffprobe_duration,
)
import clipper
import secrets

load_dotenv()

API_KEY = os.getenv("TICKLESS_API_KEY", "")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",") if o.strip()]

# Known-good link used by the daily health check.
HEALTHCHECK_URL = "https://www.tiktok.com/@scout2015/video/6718335390845095173"

HEALTHCHECK_URL_YOUTUBE = "https://www.youtube.com/watch?v=2lAe1cqCOXo"

# User-facing error messages keyed by internal code.
ERROR_MESSAGES = {
    "empty": "Paste a TikTok, Instagram, or YouTube link to get started.",
    "too_long": "That link is too long to be a real video URL.",
    "unsupported": "That does not look like a TikTok, Instagram, or YouTube link. Check it and try again.",
    # Legacy alias kept so older callers/tests keep working.
    "not_tiktok": "That does not look like a TikTok, Instagram, or YouTube link. Check it and try again.",
    "unavailable": "We could not reach this video. It may be private, removed, or region locked.",
    # Photo posts are now served via Cobalt (TikTok /photo/ and Instagram
    # carousels), so this only fires if that fallback itself found nothing.
    "slideshow": "We could not find any photos or video at that link.",
    "no_media": "Instagram is rate-limiting downloads from this server's IP right now, which affects photo posts. Reels usually still work. This is a known Instagram limitation for self-hosted instances (the official cobalt.tools works because it uses proxies). It may clear up on its own, or a proxy/different IP is the real fix.",
    "extract_failed": "Something went wrong on our side. Give it another try in a moment.",
    "extractor_down": "Our Instagram service is temporarily unavailable. Try again in a few minutes.",
    "extractor_waking": "Our Instagram service is starting up. Give it about 30 seconds and try again.",
    "ig_blocked": "Instagram is blocking our server right now. Try again in a few minutes.",
}

# Copy for the Clean tool. Kept beside ERROR_MESSAGES because the frontend
# renders `detail` verbatim, so these strings ARE the user-facing copy.
# Source of truth: docs/content.md section 11.
CLEAN_MESSAGES = {
    "unsupported": "That file type is not supported. Try an MP4, MOV, JPEG, PNG, WebP, HEIC, AVIF, or MP3.",
    "too_large": "That file is too large. The limit is 200 MB.",
    "empty": "That file is empty.",
    "clean_failed": "Something went wrong stripping the metadata. Try again, or use a different file.",
}

limiter = Limiter(key_func=get_remote_address)

# Error tracking. Inert unless SENTRY_DSN is set in the Render dashboard, so the
# service behaves exactly as before when the variable is absent, which is also
# the local and CI case. send_default_pii stays explicitly off: the privacy page
# and legal posture both promise we do not identify users, and Sentry's default
# would otherwise attach cookies and IP-derived data to every event.
# SENTRY_ENABLED is reported (as a boolean only) by /api/health/config so the
# deployed container can be checked without ever echoing the key itself.
SENTRY_ENABLED = False
if os.getenv("SENTRY_DSN"):
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[FastApiIntegration(), StarletteIntegration()],
        send_default_pii=False,
        traces_sample_rate=0.0,
        environment=os.getenv("SENTRY_ENV", "production"),
    )
    SENTRY_ENABLED = True

app = FastAPI(title="Tickless API", version="1.0.0")
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
    # allow_headers only covers the REQUEST direction. Without expose_headers a
    # cross-origin fetch() may not read Content-Disposition, so "Download all"
    # never sees the filename this API computes and falls back to an uncapped,
    # extensionless one (photos and videos then both land as an unknown "file").
    # The single-item button is unaffected because a browser navigation is not
    # subject to CORS. Server-Timing is listed for the same reason: it carries
    # the ad read's server-side duration, which is otherwise unreadable from
    # the page and turns "why are ads slow" into a guess.
    expose_headers=["Content-Disposition", "Server-Timing", "X-Clean-Removed", "X-Clean-Signals", "X-Clean-Had-AI"],
)

app.include_router(ads_router)
app.include_router(analytics_router)


@app.on_event("startup")
def _start_clip_cleanup_sweep():
    """Periodically purge parked clip uploads older than 1h (free-tier safe)."""
    import threading

    def _sweep_loop():
        while True:
            try:
                clipper.sweep_expired_uploads()
            except Exception:
                logging.exception("clip upload sweep failed")
            # Match my-video-clipper's 30-min cadence.
            threading.Event().wait(30 * 60)

    t = threading.Thread(target=_sweep_loop, daemon=True)
    t.start()


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": "Slow down a moment and try again shortly."},
    )


class ExtractRequest(BaseModel):
    url: str


_YOUTUBE_DEBUG_ENABLED = os.getenv("TICKLESS_YOUTUBE_DEBUG", "").strip().lower() in {"1", "true", "yes"}


@app.get("/api/debug/yt/cookie-state")
async def debug_yt_cookie_state():
    if not _YOUTUBE_DEBUG_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")
    import extractor as _ex
    state = _ex._youtube_cookiefile()
    redacted = state == "__browser__"
    return {
        "enabled": _YOUTUBE_DEBUG_ENABLED,
        "cookie_path": state,
        "redacted": redacted,
    }


# Characters not allowed in filenames on Windows/macOS/Android/iOS.
_FILENAME_FORBIDDEN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
# Hashtag tokens (with the tag text) - stripped, they are noise in filenames.
_HASHTAG = re.compile(r"#\S+")
# Max length of the caption-derived title portion of a download filename.
# Kept short so long TikTok/Instagram captions don't blow out the name; the
# per-gallery index suffix (_N) is appended after this cap, so it always fits.
_FILENAME_TITLE_CAP = 40


def build_download_filename(
    title: str, uploader: str, ext: str, platform: str = "tiktok", index: int | None = None
) -> tuple[str, str]:
    """Build a clean, human-readable filename for the user's device.

    Pattern: "<uploader> - <title> - Tickless.<ext>" with graceful fallbacks
    when parts are missing. Returns (utf8_name, ascii_fallback) for the
    Content-Disposition filename*= and filename= fields respectively.

    The caption-derived title is capped to _FILENAME_TITLE_CAP characters so
    long captions don't blow out the filename. The per-gallery index suffix
    (_N) is appended AFTER the cap, so it always survives regardless of how
    long the caption is.
    """
    title = _HASHTAG.sub("", title or "")
    # Collapse whitespace, strip filesystem-forbidden characters.
    parts = []
    for raw in (uploader or "", title):
        s = _FILENAME_FORBIDDEN.sub("", raw)
        s = re.sub(r"\s+", " ", s).strip(" .-_")
        if s:
            parts.append(s)

    # Keep the title portion comfortably under filesystem limits.
    stem = " - ".join(parts)[:_FILENAME_TITLE_CAP].rstrip(" .-_")
    if not stem:
        if platform == "youtube":
            stem = "youtube video" if ext == "mp4" else "youtube audio"
        else:
            stem = "tiktok video" if ext == "mp4" else "tiktok audio"
    # Per-gallery index suffix (e.g. _1, _2) — added AFTER the cap so it is
    # never truncated away, guaranteeing unique names for multi-image posts.
    if index is not None:
        stem = f"{stem}_{index + 1}"
    stem = f"{stem} - Tickless"

    utf8_name = f"{stem}.{ext}"
    # ASCII fallback for the plain filename= field (legacy browsers).
    ascii_stem = (
        unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    )
    ascii_stem = re.sub(r"\s+", " ", ascii_stem).strip(" .-_") or "Tickless download"
    ascii_name = f"{ascii_stem}.{ext}".replace('"', "")
    return utf8_name, ascii_name


async def _proxy_remote_media(url: str, tmpdir: str) -> str:
    """Stream an Instagram CDN URL through the backend to avoid client-side auth issues."""
    target = os.path.join(tmpdir, "tickless-download")
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=120,
        headers={"User-Agent": "curl/8.5"},
    ) as client:
        async with client.stream("GET", url) as resp:
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail="We could not fetch this Instagram file right now.",
                )
            content_type = resp.headers.get("content-type", "application/octet-stream")
            with open(target, "wb") as f:
                async for chunk in resp.aiter_bytes():
                    f.write(chunk)
    suffix = ".bin"
    try:
        ct = (content_type or "").lower()
        if "mp4" in ct:
            suffix = ".mp4"
        elif "jpeg" in ct or "jpg" in ct:
            suffix = ".jpg"
        elif "png" in ct:
            suffix = ".png"
        elif "webp" in ct:
            suffix = ".webp"
    except Exception:
        suffix = ".bin"
    final = target + suffix
    os.replace(target, final)
    return final


async def _cobalt_media_file(
    clean: str, dest_dir: str, gallery_index: int | None, noun: str
) -> tuple[str, str, str]:
    """Fetch ONE item of a Cobalt-served post into dest_dir.

    Shared by /api/download and /api/clip so that a preview and the trim it
    feeds always resolve to the same carousel item — that is the whole point
    of passing an index through. `gallery_index` is clamped, so an out-of-range
    index can never 500 a request.

    Instagram is served through Cobalt everywhere (extract, download, and now
    clip): yt-dlp is rate-limited for Instagram from this IP, which is why the
    clip endpoint used to answer 502 to every Instagram link while the preview
    beside it worked fine.

    Returns (path, title, uploader). Raises HTTPException on failure.
    """
    try:
        cdata = await run_in_threadpool(cobalt_extract, clean)
    except ExtractionError as e:
        # Cobalt returns no_media when Instagram blocks the fetch; yt-dlp can
        # still succeed on a good IP, so mirror /api/extract's fallback.
        if e.code != "no_media":
            raise
        try:
            return await run_in_threadpool(download_media, clean, dest_dir, "video")
        except Exception:
            raise HTTPException(status_code=400, detail=ERROR_MESSAGES["no_media"])
    gallery = cdata.get("gallery") or []
    safe_index = max(0, min(int(gallery_index or 0), len(gallery) - 1)) if gallery else 0
    primary_url = gallery[safe_index] if gallery else cdata.get("video_url")
    if not primary_url and cdata.get("photo_urls"):
        primary_url = cdata["photo_urls"][0]
    if not primary_url:
        raise HTTPException(status_code=502, detail=ERROR_MESSAGES["no_media"])
    p = await _proxy_remote_media(primary_url, dest_dir)
    return p, cdata.get("title") or f"{noun} post", cdata.get("author") or ""


def _require_key(x_tickless_key: str | None):
    # If no key configured (local dev), allow. In prod the key is always set.
    if API_KEY and x_tickless_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized.")


@app.get("/api/health")
async def health():
    from importlib.metadata import version as _v
    try:
        ver = _v("yt-dlp")
    except Exception:
        ver = "unknown"
    return {"status": "ok", "yt_dlp": ver}


@app.get("/api/health/extract")
async def health_extract():
    """Deep health check. Used by the daily cron to catch yt-dlp breakage."""
    from extractor import YOUTUBE_COOKIE, YOUTUBE_COOKIE_BROWSER, YOUTUBE_SID, YOUTUBE_SAPISID
    yt_cookie_cfg = bool(YOUTUBE_COOKIE or YOUTUBE_COOKIE_BROWSER or YOUTUBE_SID or YOUTUBE_SAPISID)
    try:
        data = extract(HEALTHCHECK_URL)
        return {"status": "ok", "has_video": bool(data.get("video_url")),
                "youtube_cookie_configured": yt_cookie_cfg}
    except ExtractionError as e:
        return JSONResponse(status_code=503, content={"status": "broken", "code": e.code,
                                                       "youtube_cookie_configured": yt_cookie_cfg})
    except Exception:
        # Any other failure (e.g. transient TikTok error) must not 500 the diag;
        # we still want the cookie flag to surface.
        return JSONResponse(status_code=503, content={"status": "broken", "code": "extract_failed",
                                                       "youtube_cookie_configured": yt_cookie_cfg})


@app.get("/api/health/cobalt")
async def health_cobalt():
    """Liveness probe for the Cobalt SIDECAR (loopback, same container).

    Cobalt runs inside this container (see backend/start.sh), so if it is
    dead, Instagram breaks while every other endpoint looks fine. That exact
    silent state used to produce Instagram 502s back when Cobalt was a
    separate Render service, so it gets its own probe.

    Deliberately does NOT run an extraction: this must stay fast and must not
    depend on Instagram being reachable. It only answers "is the sidecar
    listening and responding".
    """
    import json as _json
    import urllib.request

    cobalt_url = os.getenv("COBALT_URL", "").rstrip("/")
    if not cobalt_url:
        return JSONResponse(
            status_code=503,
            content={"status": "down", "error": "COBALT_URL not configured"},
        )
    try:
        with urllib.request.urlopen(f"{cobalt_url}/", timeout=10) as resp:
            body = _json.loads(resp.read().decode("utf-8", "replace"))
        # Surface whether Cobalt's outbound IG proxy is configured, so a missing
        # proxy (the usual cause of IG rate-limit no_media) is visible at a glance.
        proxy = os.getenv("COBALT_HTTPS_PROXY") or os.getenv("COBALT_HTTP_PROXY") or ""
        return {
            "status": "ok",
            "cobalt_version": (body.get("cobalt") or {}).get("version"),
            "url": cobalt_url,
            "instagram_proxy": proxy or "disabled",
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "down", "url": cobalt_url, "error": type(e).__name__},
        )


@app.get("/api/health/config")
async def health_config():
    """Config-only probe: reports whether YouTube cookies are wired up, without
    making any network request. Lets us verify the YOUTUBE_COOKIE env var
    actually reaches the deployed container. No secret value is leaked."""
    try:
        from extractor import (YOUTUBE_COOKIE, YOUTUBE_COOKIE_BROWSER, YOUTUBE_SID,
                               YOUTUBE_SAPISID, YOUTUBE_USE_POT)
        cookie_env = YOUTUBE_COOKIE or YOUTUBE_COOKIE_BROWSER or YOUTUBE_SID or YOUTUBE_SAPISID
        return {
            "youtube_cookie_configured": bool(cookie_env),
            "youtube_cookie_lines": (cookie_env.count("\n") + 1) if cookie_env else 0,
            "youtube_cookie_looks_like_full_jar": bool(cookie_env)
                and cookie_env.strip().startswith("# Netscape")
                and "SAPISID" in cookie_env,
            "youtube_po_token_enabled": bool(YOUTUBE_USE_POT),
            # Boolean only. Tells you whether the SDK initialised at boot,
            # without echoing the DSN (main.py never reports its value).
            "sentry_configured": SENTRY_ENABLED,
        }
    except Exception as e:  # never 500 the diagnostic
        return JSONResponse(status_code=200, content={"error": f"{type(e).__name__}: {e}"})


@app.post("/api/extract")
@limiter.limit("10/minute")
async def api_extract(
    request: Request,
    body: ExtractRequest,
    x_tickless_key: str | None = Header(default=None),
):
    _require_key(x_tickless_key)
    try:
        url, platform = normalize_and_validate(body.url)
    except ValueError as e:
        code = str(e)
        raise HTTPException(status_code=400, detail=ERROR_MESSAGES.get(code, ERROR_MESSAGES["unsupported"]))

    try:
        if platform == "instagram":
            # Run in the threadpool: a cold-start warmup can block for up to
            # COBALT_WARMUP_BUDGET (~55s), which would otherwise freeze the
            # entire event loop (TikTok extraction, health checks, etc.).
            try:
                data = await run_in_threadpool(cobalt_extract, url)
            except ExtractionError as e:
                # Photos/carousels need an authenticated/non-rate-limited IP;
                # Cobalt returns no_media (fetch.empty) when Instagram blocks
                # the fetch. yt-dlp can fetch the image when a valid cookie is
                # wired up, so fall back to it instead of failing.
                if e.code != "no_media":
                    raise
                try:
                    data = await run_in_threadpool(extract, url)
                except Exception:
                    # yt-dlp raises DownloadError (not ExtractionError) and
                    # hits the same Instagram block; surface honest message.
                    raise ExtractionError("no_media")
        else:
            try:
                data = await run_in_threadpool(extract, url)
            except ExtractionError as e:
                # TikTok photo posts (/photo/ URLs and slideshows) are not
                # supported by yt-dlp, but our Cobalt instance returns them as
                # a photo picker. Fall back to Cobalt instead of failing.
                if e.code != "use_cobalt":
                    raise
                data = await run_in_threadpool(cobalt_extract, url)
    except ExtractionError as e:
        detail = ERROR_MESSAGES.get(e.code, ERROR_MESSAGES["extract_failed"])
        if platform == "instagram" and e.code in ("unsupported", "service-unsupported"):
            detail = ERROR_MESSAGES["unsupported"]
        if e.code == "extractor_waking":
            # Cobalt is spun down / mid-boot. 503 + Retry-After is the honest
            # status: this is transient and retrying shortly will work, unlike
            # a 502 which reads as "broken".
            raise HTTPException(
                status_code=503,
                detail=detail,
                headers={"Retry-After": "30"},
            )
        status = 400 if e.code in ("slideshow", "unavailable", "no_media", "ig_blocked", "unsupported") else 502
        raise HTTPException(status_code=status, detail=detail)

    data["platform"] = platform
    return data


@app.get("/api/download")
@limiter.limit("10/minute")
async def api_download(
    request: Request,
    url: str,
    kind: str = "video",
    x_tickless_key: str | None = Header(default=None),
    key: str | None = None,
    gallery_index: int | None = None,
):
    """Download the clean video/audio server-side and stream it to the browser.

    TikTok CDN URLs are signed for the extracting client (IP/headers), so
    both direct browser links AND plain httpx proxying get 403. yt-dlp's own
    downloader handles the CDN auth correctly, so we download to a temp file
    and stream that, deleting it afterwards (Render fs is ephemeral anyway).

    Accepts the API key via header or ?key= (plain <a href> navigation
    cannot set custom headers).
    """
    _require_key(x_tickless_key or key)
    if kind not in ("video", "audio"):
        kind = "video"
    try:
        clean, platform = normalize_and_validate(url)
    except ValueError:
        raise HTTPException(status_code=400, detail=ERROR_MESSAGES["unsupported"])

    tmpdir = tempfile.mkdtemp(prefix="tickless-")

    async def _cobalt_download(noun: str):
        """Extract via Cobalt and stream the chosen gallery item to a file.

        Used for Instagram (always) and for TikTok photo posts, which yt-dlp
        cannot handle. Cobalt URLs are signed/tunnel links, so they must be
        proxied through us rather than handed to the browser.

        The whole fetch lives in _cobalt_media_file so /api/clip resolves the
        same item the same way; the "_N" filename suffix is still applied later
        (see the stem handling near build_download_filename), NOT here, or
        names come out as "_1_1".
        """
        return await _cobalt_media_file(clean, tmpdir, gallery_index, noun)

    try:
        if platform == "instagram":
            path, title, uploader = await _cobalt_download("instagram")
        else:
            try:
                path, title, uploader = await run_in_threadpool(
                    download_media, clean, tmpdir, kind
                )
            except ExtractionError as e:
                # TikTok photo post: yt-dlp cannot download it, Cobalt can.
                if e.code != "use_cobalt":
                    raise
                path, title, uploader = await _cobalt_download(platform)
    except HTTPException:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise
    except ExtractionError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        if e.code == "extractor_waking":
            # Same cold-start case as /api/extract: transient, not an outage.
            raise HTTPException(
                status_code=503,
                detail=ERROR_MESSAGES["extractor_waking"],
                headers={"Retry-After": "30"},
            )
        raise HTTPException(
            status_code=502,
            detail=ERROR_MESSAGES.get(e.code, ERROR_MESSAGES["extract_failed"]),
        )
    except Exception:
        logging.exception("download_media failed for %s", clean)
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=ERROR_MESSAGES["extract_failed"])

    if not os.path.isfile(path):
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=ERROR_MESSAGES["no_media"])

    real_ext = path.rsplit(".", 1)[-1].lower() if "." in os.path.basename(path) else "bin"
    # Use the actual downloaded file extension so photos do not get
    # mislabeled as video/mp4.
    if real_ext in ("jpg", "jpeg"):
        media_type = "image/jpeg"
    elif real_ext == "png":
        media_type = "image/png"
    elif real_ext == "webp":
        media_type = "image/webp"
    elif kind == "audio":
        media_type = "audio/mpeg" if real_ext == "mp3" else "audio/mp4"
    else:
        media_type = "video/mp4"

    # Gallery-aware unique filename. The index suffix is applied inside
    # build_download_filename AFTER the caption cap, so it is never truncated
    # away even for long captions (fixes identical names on multi-image posts).
    stem = title or "tickless-download"
    utf8_name, ascii_name = build_download_filename(stem, uploader, real_ext, index=gallery_index)

    # Count the completed download per platform (non-blocking, never fails).
    record_download(platform, kind)

    def stream_and_cleanup():
        try:
            with open(path, "rb") as f:
                while chunk := f.read(64 * 1024):
                    yield chunk
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    return StreamingResponse(
        stream_and_cleanup(),
        media_type=media_type,
        headers={
            # filename= is the ASCII fallback; filename*= is the canonical
            # UTF-8 name modern browsers use (RFC 6266).
            "Content-Disposition": (
                f'attachment; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quote(utf8_name)}"
            ),
            "Content-Length": str(os.path.getsize(path)),
        },
    )


# ===========================================================================
# Clip endpoints (manual trim + audio-only extraction, Option B integration)
# ===========================================================================

CLIP_MAX_UPLOAD_BYTES = int(os.getenv("CLIP_MAX_UPLOAD_BYTES", str(500 * 1024 * 1024)))


class ClipRequest(BaseModel):
    # Either a parked upload token (upload flow) or a source URL (link flow).
    token: str | None = None
    source_url: str | None = None
    start: float
    end: float
    audio_only: bool = False
    # Which item of a multi-item post to trim (0-based). Set only by carousels;
    # a single-video post or an upload leaves it None so filenames and routing
    # behave exactly as they did before carousels were supported.
    gallery_index: int | None = None


@limiter.limit("10/minute")
@app.post("/api/clip/upload")
async def api_clip_upload(
    request: Request,
    file: UploadFile = File(...),
    x_tickless_key: str | None = Header(default=None),
):
    """Park an uploaded source video in a temp dir; return a token + duration.

    The source stays on Render's ephemeral disk only (see clipper.CLIP_UPLOAD_ROOT)
    and is deleted after its clips are produced or after the TTL sweep. Nothing
    is persisted to Supabase. Matches the product's "we keep nothing" promise.
    """
    _require_key(x_tickless_key)
    content_type = file.content_type or ""
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Upload a video file.")
    # Read with a hard size cap so a huge upload cannot fill the free tier disk.
    data = await file.read(CLIP_MAX_UPLOAD_BYTES + 1)
    if len(data) > CLIP_MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {CLIP_MAX_UPLOAD_BYTES // (1024 * 1024)} MB).",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    token = secrets.token_urlsafe(16)
    ext = (file.filename or "upload.mp4").rsplit(".", 1)[-1].lower()
    if ext not in ("mp4", "webm", "mkv", "mov", "avi"):
        ext = "mp4"
    d = park_upload(token, file.filename or "upload")
    src = os.path.join(d, f"source.{ext}")
    with open(src, "wb") as f:
        f.write(data)

    duration = ffprobe_duration(src)
    return {"token": token, "duration": duration, "title": file.filename or "uploaded video"}


@limiter.limit("10/minute")
@app.post("/api/clip")
@app.get("/api/clip")
async def api_clip(
    request: Request,
    body: ClipRequest | None = None,
    token: str | None = None,
    source_url: str | None = None,
    start: float | None = None,
    end: float | None = None,
    audio_only: bool = False,
    gallery_index: int | None = None,
    x_tickless_key: str | None = Header(default=None),
    key: str | None = None,
):
    """Trim one segment from a source and stream it back. Lazy delivery: the
    source is trimmed on click; the segment temp file is removed after stream.

    Accepts POST (JSON) or GET (query params) so the frontend can trigger a
    real browser download via a native <a href> link (a programmatic fetch→
    blob→click inside an async loop loses the user gesture and silently fails).

    Source is resolved from `token` (uploaded) or `source_url` (fetched via
    the existing yt-dlp path). `audio_only` yields an mp3.

    Accepts the API key via header or ?key= (plain <a href> navigation
    cannot set custom headers).
    """
    # Normalize GET params into a ClipRequest.
    if body is None:
        try:
            body = ClipRequest(
                token=token,
                source_url=source_url,
                start=float(start if start is not None else 0),
                end=float(end if end is not None else 0),
                audio_only=bool(audio_only),
                gallery_index=gallery_index,
            )
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Missing or invalid start/end.")

    _require_key(x_tickless_key or key)

    # Fail fast on an invalid segment before any download/ffmpeg work.
    try:
        body.start, body.end = clipper._clamp_segment(body.start, body.end)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if body.token and body.source_url:
        raise HTTPException(status_code=400, detail="Provide a token or a source_url, not both.")
    if not body.token and not body.source_url:
        raise HTTPException(status_code=400, detail="Provide a token or a source_url.")

    # Resolve the source file (download to a temp dir if a URL was given).
    workdir = tempfile.mkdtemp(prefix="tickless-clip-")
    src: str | None = None
    source_title = "tickless-clip"
    cleanup_src = False
    try:
        if body.token:
            src = source_path_for_token(body.token)
            if not src:
                raise HTTPException(status_code=404, detail="Upload not found or expired. Re-upload the video.")
        else:
            # Reuse the verified download path: yt-dlp for TikTok/YouTube, and
            # Cobalt for TikTok photo posts. Instagram is handled below.
            try:
                clean, platform = normalize_and_validate(body.source_url or "")
            except ValueError:
                raise HTTPException(status_code=400, detail=ERROR_MESSAGES["unsupported"])
            try:
                if platform == "instagram":
                    # Resolve through the same helper /api/download uses, with
                    # the index the user picked, so the slide shown in the
                    # preview is the slide that gets trimmed. yt-dlp is
                    # rate-limited for Instagram from this IP, which is why
                    # every Instagram clip request used to answer 502 while
                    # the preview beside it worked fine.
                    src, source_title, _ = await _cobalt_media_file(
                        clean, workdir, body.gallery_index, "instagram"
                    )
                else:
                    src, source_title, _ = await run_in_threadpool(
                        download_media, clean, workdir, "video"
                    )
            except ExtractionError as e:
                if e.code != "use_cobalt":
                    raise HTTPException(
                        status_code=502,
                        detail=ERROR_MESSAGES.get(e.code, ERROR_MESSAGES["extract_failed"]),
                    )
                # TikTok photo post: no video stream to clip.
                raise HTTPException(status_code=400, detail=ERROR_MESSAGES["slideshow"])
            except HTTPException:
                raise
            except Exception:
                logging.exception("clip download failed for %s", body.source_url)
                raise HTTPException(status_code=502, detail=ERROR_MESSAGES["extract_failed"])
            cleanup_src = True

        if not src or not os.path.isfile(src):
            raise HTTPException(status_code=502, detail=ERROR_MESSAGES["no_media"])

        # A photo has no stream to trim. A carousel can be photo-only, so
        # reject it with the same 400 a TikTok photo post already gets instead
        # of letting ffmpeg fail into a confusing 502. The outer handler
        # removes workdir. Only real image types are caught — an unknown
        # content-type lands as .bin and may still be a valid video.
        if os.path.splitext(src)[1].lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            raise HTTPException(status_code=400, detail=ERROR_MESSAGES["slideshow"])

        ext = "mp3" if body.audio_only else "mp4"
        out_path = os.path.join(workdir, f"clip.{ext}")
        try:
            await run_in_threadpool(
                trim_segment, src, body.start, body.end, out_path, body.audio_only
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except RuntimeError as e:
            logging.exception("ffmpeg trim failed")
            raise HTTPException(status_code=502, detail=f"Could not create the clip: {e}")

        if not os.path.isfile(out_path):
            raise HTTPException(status_code=502, detail=ERROR_MESSAGES["extract_failed"])

        media_type = "audio/mpeg" if body.audio_only else "video/mp4"
        # build_download_filename appends " - Tickless" itself, so pass the raw
        # source title as the title; the per-clip label comes from the caller's
        # editable filename on the frontend, not here.
        # index= mirrors what /api/download already does for carousels: it adds
        # an _N suffix so two clips trimmed from different slides cannot collide.
        # It is None for a single-video post or an upload, so those names are
        # exactly what they were before carousels were supported.
        utf8_name, ascii_name = build_download_filename(
            source_title, "", ext, index=body.gallery_index
        )

        def stream_and_cleanup():
            try:
                with open(out_path, "rb") as f:
                    while chunk := f.read(64 * 1024):
                        yield chunk
            finally:
                # Remove the whole workdir (source + segment) after streaming.
                shutil.rmtree(workdir, ignore_errors=True)

        return StreamingResponse(
            stream_and_cleanup(),
            media_type=media_type,
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{ascii_name}"; '
                    f"filename*=UTF-8''{quote(utf8_name)}"
                ),
                "Content-Length": str(os.path.getsize(out_path)),
            },
        )
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise


# ===========================================================================
# Clean endpoint (AI metadata stripping, /clean)
# ===========================================================================


def _clean_output_name(original: str, ext: str) -> str:
    """Build the download name: 'clip.mp4' -> 'clip-clean.mp4'.

    Sanitized to ASCII so it can go straight into the filename= fallback of
    Content-Disposition, mirroring how /api/download builds its names.
    """
    stem = os.path.basename(original or "")
    stem = stem.rsplit(".", 1)[0] if "." in stem else stem
    stem = "".join(c for c in stem if c.isalnum() or c in (" ", "-", "_")).strip()
    # The fallback is the STEM, not the whole name: "-clean" is appended
    # below, so seeding it as "tickless-clean" would yield
    # "tickless-clean-clean.jpg".
    stem = stem[:80] or "tickless"
    return f"{stem}-clean.{ext}"


@limiter.limit("10/minute")
@app.post("/api/clean")
async def api_clean(
    request: Request,
    file: UploadFile = File(...),
    x_tickless_key: str | None = Header(default=None),
):
    """Strip AI provenance metadata from an uploaded file and stream it back.

    The file is read once, cleaned into a temp dir, streamed to the browser
    with the counts in headers, and deleted. Nothing is persisted, matching
    the product's "we keep nothing" promise (see /api/clip/upload).

    The frontend fetches this as a blob so it can show what was removed and
    only then hand the user a real download link.
    """
    _require_key(x_tickless_key)

    ext = extension_of(file.filename or "")
    if ext not in SUPPORTED_EXTS:
        raise HTTPException(status_code=400, detail=CLEAN_MESSAGES["unsupported"])

    data = await file.read(MAX_CLEAN_BYTES + 1)
    if len(data) == 0:
        raise HTTPException(status_code=400, detail=CLEAN_MESSAGES["empty"])
    if len(data) > MAX_CLEAN_BYTES:
        raise HTTPException(status_code=413, detail=CLEAN_MESSAGES["too_large"])

    workdir = tempfile.mkdtemp(prefix="tickless-clean-")
    src = os.path.join(workdir, f"source.{ext}")
    out = os.path.join(workdir, f"clean.{ext}")
    try:
        with open(src, "wb") as f:
            f.write(data)

        # ExifTool/FFmpeg are blocking subprocesses: keep them off the loop.
        try:
            result = await run_in_threadpool(strip_ai, src, out)
        except CleanError as e:
            raise HTTPException(
                status_code=400 if e.code == "unsupported" else 500,
                detail=CLEAN_MESSAGES.get(e.code, CLEAN_MESSAGES["clean_failed"]),
            )
        except Exception:
            logging.exception("clean failed for %s", file.filename)
            raise HTTPException(status_code=500, detail=CLEAN_MESSAGES["clean_failed"])

        if not os.path.isfile(out) or os.path.getsize(out) == 0:
            raise HTTPException(status_code=500, detail=CLEAN_MESSAGES["clean_failed"])

        utf8_name = _clean_output_name(file.filename or "", ext)
        # ASCII fallback for the filename= parameter (RFC 6266).
        ascii_name = utf8_name.encode("ascii", "replace").decode("ascii").replace('"', "")

        def stream_and_cleanup():
            try:
                with open(out, "rb") as f:
                    while chunk := f.read(64 * 1024):
                        yield chunk
            finally:
                shutil.rmtree(workdir, ignore_errors=True)

        return StreamingResponse(
            stream_and_cleanup(),
            media_type=SUPPORTED_EXTS[ext],
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{ascii_name}"; '
                    f"filename*=UTF-8''{quote(utf8_name)}"
                ),
                "Content-Length": str(os.path.getsize(out)),
                # Header values are ASCII-only; the labels are sanitized
                # rather than trusted, since they originate in a subprocess.
                "X-Clean-Removed": str(result.get("removed", 0)),
                "X-Clean-Had-AI": "1" if result.get("had_ai") else "0",
                "X-Clean-Signals": ", ".join(result.get("signals") or []).encode(
                    "ascii", "replace"
                ).decode("ascii"),
            },
        )
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
