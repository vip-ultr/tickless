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
from fastapi import FastAPI, Header, HTTPException, Request
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
from validation import normalize_and_validate
from ads import router as ads_router
from analytics import router as analytics_router, record_download

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
    "slideshow": "This is a photo post. Photo to video is coming soon. Video posts work right now.",
    "no_media": "We could not find a downloadable video at that link.",
    "extract_failed": "Something went wrong on our side. Give it another try in a moment.",
    "extractor_down": "Our Instagram service is temporarily unavailable. Try again in a few minutes.",
    "ig_blocked": "Instagram is blocking our server right now. Try again in a few minutes.",
}

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Tickless API", version="1.0.0")
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(ads_router)
app.include_router(analytics_router)


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


def build_download_filename(
    title: str, uploader: str, ext: str, platform: str = "tiktok"
) -> tuple[str, str]:
    """Build a clean, human-readable filename for the user's device.

    Pattern: "<uploader> - <title> - Tickless.<ext>" with graceful fallbacks
    when parts are missing. Returns (utf8_name, ascii_fallback) for the
    Content-Disposition filename*= and filename= fields respectively.
    """
    title = _HASHTAG.sub("", title or "")
    # Collapse whitespace, strip filesystem-forbidden characters.
    parts = []
    for raw in (uploader or "", title):
        s = _FILENAME_FORBIDDEN.sub("", raw)
        s = re.sub(r"\s+", " ", s).strip(" .-_")
        if s:
            parts.append(s)

    # Keep the total stem comfortably under filesystem limits.
    stem = " - ".join(parts)[:80].rstrip(" .-_")
    if not stem:
        if platform == "youtube":
            stem = "youtube video" if ext == "mp4" else "youtube audio"
        else:
            stem = "tiktok video" if ext == "mp4" else "tiktok audio"
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
            data = cobalt_extract(url)
        else:
            data = extract(url)
    except ExtractionError as e:
        detail = ERROR_MESSAGES.get(e.code, ERROR_MESSAGES["extract_failed"])
        if platform == "instagram" and e.code in ("unsupported", "service-unsupported"):
            detail = ERROR_MESSAGES["unsupported"]
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
    try:
        if platform == "instagram":
            ig_data = await run_in_threadpool(cobalt_extract, clean)
            gallery = ig_data.get("gallery") or []
            safe_index = max(0, min(int(gallery_index or 0), len(gallery) - 1)) if gallery else 0
            primary_url = gallery[safe_index] if gallery else ig_data.get("video_url")
            if not primary_url and ig_data.get("photo_urls"):
                primary_url = ig_data["photo_urls"][0]
            if not primary_url:
                raise HTTPException(status_code=502, detail=ERROR_MESSAGES["no_media"])
            path = await _proxy_remote_media(primary_url, tmpdir)
            title = ig_data.get("title") or "instagram post"
            uploader = ig_data.get("author") or ""
        else:
            path, title, uploader = await run_in_threadpool(download_media, clean, tmpdir, kind)
    except HTTPException:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise
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

    # Gallery-aware unique filename
    stem = title or "tickless-download"
    if gallery_index is not None:
        stem = f"{stem}_{gallery_index + 1}"
    utf8_name, ascii_name = build_download_filename(stem, uploader, real_ext)

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
