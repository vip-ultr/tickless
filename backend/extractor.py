"""Media extraction via yt-dlp. Returns clean (no-watermark) media metadata."""
import os
import shutil
import tempfile

import yt_dlp
from yt_dlp.utils import DownloadError

from validation import is_photo_slideshow

# Instagram requires an authenticated session since mid-2026 (yt-dlp issue
# 17074): anonymous requests get "empty media response" even for public
# reels. Operators can set IG_SESSIONID (the sessionid cookie value from a
# logged-in browser) to enable Instagram support. Without it, IG links fail
# with a clean user-facing error.
IG_SESSIONID = os.getenv("IG_SESSIONID", "").strip()
# Browsers show the cookie URL-encoded (%3A for ':'); the jar needs it raw.
if "%" in IG_SESSIONID:
    from urllib.parse import unquote
    IG_SESSIONID = unquote(IG_SESSIONID)

_ig_cookie_file: str | None = None


def _ig_cookiefile() -> str | None:
    """Materialize a Netscape cookie jar for Instagram from IG_SESSIONID."""
    global _ig_cookie_file
    if not IG_SESSIONID:
        return None
    if _ig_cookie_file and os.path.isfile(_ig_cookie_file):
        return _ig_cookie_file
    fd, path = tempfile.mkstemp(prefix="tickless-ig-", suffix=".txt")
    with os.fdopen(fd, "w") as f:
        f.write("# Netscape HTTP Cookie File\n")
        f.write(
            f".instagram.com\tTRUE\t/\tTRUE\t0\tsessionid\t{IG_SESSIONID}\n"
        )
    _ig_cookie_file = path
    return path


# YouTube started challenging anonymous server-side requests from some
# cloud ranges. We can reuse browser cookies through either a raw cookie
# env var or yt-dlp's browser profile extraction.
YOUTUBE_COOKIE = os.getenv("YOUTUBE_COOKIE", "").strip()
YOUTUBE_COOKIE_BROWSER = os.getenv("YOUTUBE_COOKIE_BROWSER", "").strip()

_youtube_cookie_file: str | None = None


def _youtube_cookiefile() -> str | None:
    """Materialize a Netscape cookie jar for YouTube if cookie data exists."""
    global _youtube_cookie_file
    if _youtube_cookie_file and os.path.isfile(_youtube_cookie_file):
        return _youtube_cookie_file

    raw = YOUTUBE_COOKIE
    if raw:
        fd, path = tempfile.mkstemp(prefix="tickless-yt-", suffix=".txt")
        with os.fdopen(fd, "w") as f:
            f.write("# Netscape HTTP Cookie File\n")
            f.write(".youtube.com\tTRUE\t/\tTRUE\t0\tcookie\t" + raw + "\n")
        _youtube_cookie_file = path
        return path

    if YOUTUBE_COOKIE_BROWSER:
        return "__browser__:" + YOUTUBE_COOKIE_BROWSER

    return None


def _platform_cookie_opts(url: str) -> dict:
    """Extra cookie/auth yt-dlp options for specific platforms."""
    if "instagram.com" in url or "instagr.am" in url:
        cookiefile = _ig_cookiefile()
        if cookiefile:
            return {"cookiefile": cookiefile}
    if "youtube.com" in url or "youtu.be" in url or "music.youtube.com" in url:
        cookiefile = _youtube_cookiefile()
        if cookiefile:
            return {"cookiefile": cookiefile}
    return {}


_YOUTUBE_PLAYER_CLIENTS = ("web", "android", "mweb", "tv.html5")
_YOUTUBE_LAST_PLAYER_CLIENT: str | None = None


def _yt_browser_fallback_opts(url: str) -> dict:
    """Try alternate YouTube player clients if cookies are not configured.

    Some ranges block default anonymous requests; mobile/web clients often
    still succeed without requiring real account cookies.
    """
    global _YOUTUBE_LAST_PLAYER_CLIENT
    out: dict = {}
    for client in _YOUTUBE_PLAYER_CLIENTS:
        if _try_yt_player_client(url, client):
            out["extractor_args"] = {"youtube": {"player_client": [client]}}
            _YOUTUBE_LAST_PLAYER_CLIENT = client
            return out
    return out


def _try_yt_player_client(url: str, client: str) -> bool:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "extractor_args": {"youtube": {"player_client": [client]}},
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        return bool(info)
    except Exception:
        return False


def extract_raw(url: str) -> dict:
    """Full yt-dlp info dict (includes http_headers needed to fetch the CDN URL)."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        return dict(ydl.extract_info(url, download=False))


def download_media(url: str, dest_dir: str, kind: str = "video") -> tuple[str, str, str]:
    """Download the clean media server-side via yt-dlp (it handles TikTok's
    CDN auth/headers correctly, unlike a plain HTTP client).

    Returns (file_path, title, uploader). Raises on failure.
    """
    is_audio = kind == "audio"
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": f"{dest_dir}/%(id)s.%(ext)s",
        "restrictfilenames": True,
        "socket_timeout": 20,
        "retries": 5,
        "fragment_retries": 5,
    }
    opts.update(_platform_cookie_opts(url))
    if is_audio:
        opts["format"] = "bestaudio/best"
        if shutil.which("ffmpeg"):
            opts["postprocessors"] = [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
            ]
        # Without ffmpeg (local dev only; the Docker image ships it) we
        # serve the original audio container instead of converting.
    else:
        # Prefer clean progressive mp4 (play_addr), fall back to best.
        opts["format"] = "best[ext=mp4]/best"

    with yt_dlp.YoutubeDL(opts) as ydl:
        # TikTok's web page intermittently fails extraction ("universal data
        # for rehydration"); a single retry usually succeeds.
        last_err = None
        for _ in range(5):
            try:
                info = ydl.extract_info(url, download=True)
                break
            except DownloadError as e:
                last_err = e
                # On YouTube bot-wall without effective cookies, try an
                # alternate player client without relying on account cookies.
                if "not a bot" in str(e).lower() and "youtube" in str(e).lower() and not _platform_cookie_opts(url):
                    opts = {**opts, **_yt_browser_fallback_opts(url)}
        else:
            raise last_err if last_err else DownloadError("extraction failed")
        title = (info.get("title") or "").strip()
        uploader = (info.get("uploader") or info.get("creator") or "").strip()
        path = ydl.prepare_filename(info)
        if is_audio and shutil.which("ffmpeg"):
            path = path.rsplit(".", 1)[0] + ".mp3"
        return path, title, uploader


class ExtractionError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


_YDL_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": False,
}


def _pick_best_video(info: dict) -> dict | None:
    """Return the best progressive mp4 with audio, preferring higher resolution."""
    formats = info.get("formats") or []
    candidates = [
        f for f in formats
        if f.get("url")
        and f.get("vcodec") not in (None, "none")
        and f.get("acodec") not in (None, "none")
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda f: (f.get("height") or 0, f.get("tbr") or 0), reverse=True)
    return candidates[0]


def extract(url: str) -> dict:
    """Extract clean media info. Raises ExtractionError with a code on failure."""
    try:
        with yt_dlp.YoutubeDL({**_YDL_OPTS, **_platform_cookie_opts(url)}) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as e:
        msg = str(e).lower()
        if "empty media response" in msg or "login" in msg or "rate-limit" in msg or "rate limit" in msg or "not a bot" in msg:
            # Instagram anti-bot wall or YouTube bot wall.
            code = "ig_blocked" if "instagram" in msg else "extract_failed"
            raise ExtractionError(code)
        if "private" in msg or "unavailable" in msg or "not available" in msg:
            raise ExtractionError("unavailable")
        raise ExtractionError("extract_failed")
    except Exception:
        raise ExtractionError("extract_failed")

    if not info:
        raise ExtractionError("extract_failed")

    if is_photo_slideshow(info):
        raise ExtractionError("slideshow")

    best = _pick_best_video(info)
    video_url = (best or {}).get("url") or info.get("url")
    if not video_url:
        raise ExtractionError("no_media")

    # Audio-only stream if available
    audio_url = None
    for f in (info.get("formats") or []):
        if f.get("acodec") not in (None, "none") and f.get("vcodec") in (None, "none") and f.get("url"):
            audio_url = f["url"]
            break

    return {
        "title": (info.get("title") or info.get("description") or "video")[:200],
        "author": info.get("uploader") or info.get("creator") or "",
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "video_url": video_url,
        "audio_url": audio_url,
        "width": (best or {}).get("width"),
        "height": (best or {}).get("height"),
    }
