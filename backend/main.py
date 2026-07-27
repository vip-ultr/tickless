"""Tickless backend - FastAPI app.

Endpoints:
  GET  /api/health            -> liveness
  GET  /api/health/extract    -> deep check (runs a real extraction)
  POST /api/extract           -> extract clean TikTok media (auth + rate limited)
"""
import logging
import os
import shutil
import tempfile
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
from validation import normalize_and_validate
from ads import router as ads_router

load_dotenv()

API_KEY = os.getenv("TICKLESS_API_KEY", "")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",") if o.strip()]

# Known-good link used by the daily health check.
HEALTHCHECK_URL = "https://www.tiktok.com/@scout2015/video/6718335390845095173"

# User-facing error messages keyed by internal code.
ERROR_MESSAGES = {
    "empty": "Paste a TikTok link to get started.",
    "too_long": "That link is too long to be a TikTok URL.",
    "not_tiktok": "That does not look like a TikTok link. Check it and try again.",
    "unavailable": "We could not reach this video. It may be private, removed, or region locked.",
    "slideshow": "This is a photo slideshow. Slideshow to video is coming soon. Video posts work right now.",
    "no_media": "We could not find a downloadable video at that link.",
    "extract_failed": "Something went wrong on our side. Give it another try in a moment.",
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


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": "Slow down a moment and try again shortly."},
    )


class ExtractRequest(BaseModel):
    url: str


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
        url = normalize_and_validate(body.url)
    except ValueError as e:
        code = str(e)
        raise HTTPException(status_code=400, detail=ERROR_MESSAGES.get(code, ERROR_MESSAGES["not_tiktok"]))

    try:
        data = extract(url)
    except ExtractionError as e:
        status = 400 if e.code in ("slideshow", "unavailable", "no_media") else 502
        raise HTTPException(status_code=status, detail=ERROR_MESSAGES.get(e.code, ERROR_MESSAGES["extract_failed"]))

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
        clean = normalize_and_validate(url)
    except ValueError:
        raise HTTPException(status_code=400, detail=ERROR_MESSAGES["not_tiktok"])

    tmpdir = tempfile.mkdtemp(prefix="tickless-")
    try:
        path, title = await run_in_threadpool(download_media, clean, tmpdir, kind)
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
    safe_name = quote(f"{title}.{real_ext}")

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
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
            "Content-Length": str(os.path.getsize(path)),
        },
    )
