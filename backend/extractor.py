"""Media extraction via yt-dlp. Returns clean (no-watermark) media metadata."""
import os
import shutil
import tempfile

import yt_dlp
from yt_dlp.utils import DownloadError

from validation import is_photo_slideshow

# yt-dlp's YouTube signature/"n"-challenge solver shells out to `node`. If node
# is installed but not on PATH (common in some containers), extraction fails with
# "No video formats found" even with valid cookies. Prepend the usual node
# locations so yt-dlp can always find it.
for _node_dir in ("/usr/bin", "/usr/local/bin", "/opt/node/bin"):
    if os.path.isdir(_node_dir) and _node_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = f"{os.environ.get('PATH', '')}:{_node_dir}"

# PO-token provider (bgutil-ytdlp-pot-provider) lets yt-dlp beat YouTube's bot
# wall WITHOUT account cookies: it requests a Proof-of-Origin token from a
# local provider backend that solves YouTube's BotGuard challenge. We use the
# Rust port (bgutil-ytdlp-pot-provider-rs) as that backend — a single static
# binary (bgutil-pot) running an HTTP server on POT_PROVIDER_URL. No Chrome,
# no Node, no account needed; safe from a datacenter IP.
try:
    import bgutil_ytdlp_pot_provider  # noqa: F401  (plugin side-effect registers it)
    _POT_PLUGIN = True
except Exception:
    _POT_PLUGIN = False

# The bgutil-pot Rust binary location (installed in the Docker image).
_POT_BINARY = os.getenv("POT_BINARY", "/usr/local/bin/bgutil-pot")
# Where the provider HTTP server listens (the Rust binary is launched with
# --address/--port to match this).
POT_PROVIDER_URL = os.getenv("POT_PROVIDER_URL", "http://127.0.0.1:4416").rstrip("/")

YOUTUBE_POT_ENABLED = os.getenv("YOUTUBE_POT_ENABLED", "1").strip().lower() not in (
    "0", "false", "no",
)


def _pot_binary_present() -> bool:
    return os.path.isfile(_POT_BINARY) and os.access(_POT_BINARY, os.X_OK)


# True only when the plugin is importable AND the Rust provider binary exists.
# This is what lets us defeat the bot wall from a datacenter IP without cookies.
YOUTUBE_USE_POT = _POT_PLUGIN and _pot_binary_present() and YOUTUBE_POT_ENABLED

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
YOUTUBE_SID = os.getenv("YOUTUBE_SID", "").strip()
YOUTUBE_SAPISID = os.getenv("YOUTUBE_SAPISID", "").strip()

_youtube_cookie_file: str | None = None


def _youtube_cookiefile() -> str | None:
    """Materialize a Netscape cookie jar for YouTube if cookie data exists.

    YOUTUBE_COOKIE accepts EITHER a single raw cookie value OR a full
    Netscape/PERL cookies.txt export (paste your whole cookies.txt). The full
    export is strongly preferred: YouTube's bot-wall requires the real auth
    cookies (CONSENT, __Secure-*, SID, SAPISID, etc.), which a single-value
    jar cannot satisfy.
    """
    global _youtube_cookie_file
    if _youtube_cookie_file and os.path.isfile(_youtube_cookie_file):
        return _youtube_cookie_file

    raw = (YOUTUBE_COOKIE or "").strip()
    if raw:
        # Full Netscape jar (contains newlines / "# Netscape" header)?
        if "\n" in raw or raw.startswith("#"):
            fd, path = tempfile.mkstemp(prefix="tickless-yt-", suffix=".txt")
            with os.fdopen(fd, "w") as f:
                f.write(raw if raw.endswith("\n") else raw + "\n")
            _youtube_cookie_file = path
            return path
        # Single raw cookie value (legacy): build a minimal jar.
        fd, path = tempfile.mkstemp(prefix="tickless-yt-", suffix=".txt")
        with os.fdopen(fd, "w") as f:
            f.write("# Netscape HTTP Cookie File\n")
            f.write(".youtube.com\tTRUE\t/\tTRUE\t0\tcookie\t" + raw + "\n")
        _youtube_cookie_file = path
        return path

    if YOUTUBE_SID or YOUTUBE_SAPISID:
        fd, path = tempfile.mkstemp(prefix="tickless-yt-", suffix=".txt")
        with os.fdopen(fd, "w") as f:
            f.write("# Netscape HTTP Cookie File\n")
            if YOUTUBE_SID:
                f.write(".youtube.com\tTRUE\t/\tTRUE\t0\tSID\t" + YOUTUBE_SID + "\n")
                f.write(".google.com\tTRUE\t/\tTRUE\t0\tSID\t" + YOUTUBE_SID + "\n")
            if YOUTUBE_SAPISID:
                f.write(".youtube.com\tTRUE\t/\tTRUE\t0\tSAPISID\t" + YOUTUBE_SAPISID + "\n")
                f.write(".google.com\tTRUE\t/\tTRUE\t0\tSAPISID\t" + YOUTUBE_SAPISID + "\n")
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


def _is_youtube_url(url: str) -> bool:
    u = url.lower()
    return any(h in u for h in ("youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"))


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
                if "not a bot" in str(e).lower() and _is_youtube_url(url) and not _platform_cookie_opts(url):
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
    # Best-effort: try to route around soft geo restrictions. This does NOT
    # defeat a hard uploader country-lock (that needs an egress IP in an
    # allowed country, i.e. a proxy/VPN), but it helps some regions.
    "geo_bypass": True,
}
# When the PO-token provider is available (datacenter IP, no cookies), request
# the `web`/`web_safari` clients so yt-dlp auto-injects the solved po_token, and
# point the bgutil plugin at our local Rust provider HTTP server.
if YOUTUBE_USE_POT:
    _YDL_OPTS["extractor_args"] = {
        "youtube": {"player_client": ["web_safari", "web"]},
        "youtubepot-bgutilhttp": {"base_url": POT_PROVIDER_URL},
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
    opts_base = {**_YDL_OPTS, **_platform_cookie_opts(url)}
    try:
        with yt_dlp.YoutubeDL(opts_base) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as e:
        msg = str(e).lower()
        if ("empty media response" in msg or "login" in msg or "rate-limit" in msg or "rate limit" in msg or "not a bot" in msg):
            code = "ig_blocked" if "instagram" in msg else "extract_failed"
            is_yt_bot = _is_youtube_url(url) and "not a bot" in msg
            # If cookies are configured, retry WITH them first (this is what
            # actually beats the "confirm you're not a bot" wall from a
            # datacenter IP). Only fall back to anonymous player clients if
            # no cookies are present.
            if is_yt_bot:
                cookie_opts = _platform_cookie_opts(url)
                if cookie_opts:
                    try:
                        with yt_dlp.YoutubeDL({**_YDL_OPTS, **cookie_opts}) as ydl:
                            info = ydl.extract_info(url, download=False)
                        # Success with cookies -> continue below.
                    except Exception:
                        raise ExtractionError(code)
                elif YOUTUBE_USE_POT:
                    # Cookie-less bot-wall defeat: let the PO-token provider
                    # solve YouTube's Proof-of-Origin challenge for the `web`
                    # client. No account needed.
                    try:
                        with yt_dlp.YoutubeDL({**_YDL_OPTS, "extractor_args":
                            {"youtube": {"player_client": ["web_safari", "web"]}}}) as ydl:
                            info = ydl.extract_info(url, download=False)
                    except Exception:
                        raise ExtractionError(code)
                else:
                    fallback = _yt_browser_fallback_opts(url)
                    if fallback:
                        try:
                            with yt_dlp.YoutubeDL({**opts_base, **fallback}) as ydl:
                                info = ydl.extract_info(url, download=False)
                        except Exception:
                            raise ExtractionError(code)
                    else:
                        raise ExtractionError(code)
            else:
                raise ExtractionError(code)
        # Geo / country lock: "not available in your country", "has not made
        # this video available", "country". Returns a clean message, not a 502.
        if "not available in your country" in msg or "not made this video available" in msg or "country" in msg or "geo" in msg:
            raise ExtractionError("unavailable")
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
