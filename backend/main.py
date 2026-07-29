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

# User-facing error messages keyed by internal code.
ERROR_MESSAGES = {
    "empty": "Paste a TikTok or Instagram link to get started.",
    "too_long": "That link is too long to be a real video URL.",
    "unsupported": "That does not look like a TikTok or Instagram link. Check it and try again.",
    # Legacy alias kept so older callers/tests keep working.
    "not_tiktok": "That does not look like a TikTok or Instagram link. Check it and try again.",
    "unavailable": "We could not reach this video. It may be private, removed, or region locked.",
    "slideshow": "This is a photo post. Photo to video is coming soon. Video posts work right now.",
    "no_media": "We could not find a downloadable video at that link.",
    "extract_failed": "Something went wrong on our side. Give it another try in a moment.",
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


# Characters not allowed in filenames on Windows/macOS/Android/iOS.
_FILENAME_FORBIDDEN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
# Hashtag tokens (with the tag text) - stripped, they are noise in filenames.
_HASHTAG = re.compile(r"#\S+")


def build_download_filename(title: str, uploader: str, ext: str) -> tuple[str, str]:
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
    try:
        data = extract(HEALTHCHECK_URL)
        return {"status": "ok", "has_video": bool(data.get("video_url"))}
    except ExtractionError as e:
        return JSONResponse(status_code=503, content={"status": "broken", "code": e.code})


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
        path, title, uploader = await run_in_threadpool(download_media, clean, tmpdir, kind)
    except Exception:
        logging.exception("download_media failed for %s", clean)
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=ERROR_MESSAGES["extract_failed"])

    if not os.path.isfile(path):
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=ERROR_MESSAGES["no_media"])

    real_ext = path.rsplit(".", 1)[-1].lower() if "." in os.path.basename(path) else "bin"
    if kind == "audio":
        media_type = "audio/mpeg" if real_ext == "mp3" else "audio/mp4"
    else:
        media_type = "video/mp4"

    utf8_name, ascii_name = build_download_filename(title, uploader, real_ext)

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
