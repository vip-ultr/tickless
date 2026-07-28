"""URL validation and hardening for supported platform links."""
from urllib.parse import urlparse

from platforms import detect_platform

MAX_URL_LEN = 500


def normalize_and_validate(raw: str) -> tuple[str, str]:
    """Return (clean_url, platform) or raise ValueError with a safe code.

    Platform is detected from the hostname; unsupported hosts raise
    "unsupported".
    """
    if not raw or not isinstance(raw, str):
        raise ValueError("empty")
    url = raw.strip()
    if len(url) > MAX_URL_LEN:
        raise ValueError("too_long")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower().split(":")[0]
    platform = detect_platform(host)
    if not platform:
        raise ValueError("unsupported")
    return url, platform


def is_photo_slideshow(info: dict) -> bool:
    """Detect photo/slideshow posts (not supported)."""
    if not info:
        return False
    if info.get("_type") == "playlist" and info.get("entries"):
        return all(not e.get("url") and e.get("thumbnail") for e in info["entries"] if e)
    return False
