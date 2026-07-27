"""URL validation and hardening for TikTok links."""
import re
from urllib.parse import urlparse

MAX_URL_LEN = 500

# Accepted TikTok hostnames (full + short link variants) and Douyin.
_ALLOWED_HOSTS = {
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
    "v.douyin.com",
}

_VIDEO_PATH = re.compile(r"/(video|photo|v)/|/@[\w.\-]+/")


def normalize_and_validate(raw: str) -> str:
    """Return a cleaned TikTok URL or raise ValueError with a safe message."""
    if not raw or not isinstance(raw, str):
        raise ValueError("empty")
    url = raw.strip()
    if len(url) > MAX_URL_LEN:
        raise ValueError("too_long")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower().split(":")[0]
    if host not in _ALLOWED_HOSTS:
        raise ValueError("not_tiktok")
    return url


def is_photo_slideshow(info: dict) -> bool:
    """Detect TikTok photo/slideshow posts (v1 teaser, not yet supported)."""
    if not info:
        return False
    # yt-dlp marks image posts differently; check for absence of a playable video url
    if info.get("_type") == "playlist" and info.get("entries"):
        return all(not e.get("url") and e.get("thumbnail") for e in info["entries"] if e)
    return False
