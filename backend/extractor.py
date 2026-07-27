"""TikTok extraction via yt-dlp. Returns clean (no-watermark) media metadata."""
import yt_dlp
from yt_dlp.utils import DownloadError

from validation import is_photo_slideshow


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
        with yt_dlp.YoutubeDL(_YDL_OPTS) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as e:
        msg = str(e).lower()
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
        "title": (info.get("title") or info.get("description") or "TikTok video")[:200],
        "author": info.get("uploader") or info.get("creator") or "",
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "video_url": video_url,
        "audio_url": audio_url,
        "width": (best or {}).get("width"),
        "height": (best or {}).get("height"),
    }
