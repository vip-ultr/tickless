"""Cobalt API client for non-TikTok platforms."""
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from extractor import ExtractionError

COBALT_TIMEOUT = int(os.getenv("COBALT_TIMEOUT", "120"))
# After Render spins a service down and back up, the *separate* Cobalt service
# stays cold, so the first request 502s until it wakes (this is why TikTok works
# but Instagram 502s on a cold start). The fix: instead of a fire-and-forget ping
# (which times out at 10s and gets ignored while Cobalt is still booting), we
# POLL Cobalt until it actually responds, then do the real extraction. Live
# measurement: a cold Render free-tier boot is ~23s, so budget 55s to stay safe.
COBALT_WARMUP = os.getenv("COBALT_WARMUP", "1").strip().lower() not in ("0", "false", "no")
# How long to keep polling for a cold Cobalt instance before giving up and
# letting the normal 5xx-retry / error path take over.
COBALT_WARMUP_BUDGET = int(os.getenv("COBALT_WARMUP_BUDGET", "55"))
# Poll interval while waiting for Cobalt to wake.
COBALT_WARMUP_INTERVAL = float(os.getenv("COBALT_WARMUP_INTERVAL", "3"))
COBALT_MAX_RETRIES = int(os.getenv("COBALT_MAX_RETRIES", "4"))


def _headers() -> dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _warm_up_cobalt(cobalt_url: str) -> bool:
    """Poll Cobalt until it responds. Returns True if it came up.

    Cobalt now runs as a LOOPBACK SIDECAR inside this same container
    (backend/start.sh), so in production it is already listening before
    uvicorn accepts its first request and this poll returns immediately.

    It is kept for two reasons: local development, where Cobalt may be
    started separately or point at a remote instance, and defence in depth
    if the sidecar is restarting.

    HISTORY (measured Aug 2026): Cobalt used to be a SEPARATE Render free
    service, and from INSIDE Render this poll could not wake it at all.
    Render routes service-to-service traffic internally, straight to the
    stopped container, which refuses the connection instantly rather than
    going through the public proxy that boots it. Evidence: warm backend +
    cold Cobalt failed in 13s (= retry backoff only, every probe failing
    INSTANTLY rather than timing out) while the identical request from an
    external host saw HTTP 000 for ~4 probes then 200 at ~15s. Co-locating
    the sidecar removes that failure mode by construction.
    """
    deadline = time.monotonic() + COBALT_WARMUP_BUDGET
    while True:
        try:
            urllib.request.urlopen(f"{cobalt_url}/", timeout=COBALT_WARMUP_INTERVAL)
            return True  # Cobalt responded, it's up.
        except urllib.error.HTTPError:
            # Any HTTP status means something is listening: Cobalt is up.
            return True
        except Exception:
            pass  # Still cold (refused / timeout) — keep polling.
        if time.monotonic() >= deadline:
            return False
        time.sleep(COBALT_WARMUP_INTERVAL)


def _read_body(http_error: urllib.error.HTTPError):
    """Best-effort JSON parse of an HTTPError response body."""
    try:
        return json.loads(http_error.read().decode("utf-8", "replace"))
    except Exception:
        return None


def _canon_cobalt_error(payload: dict) -> str:
    """Map a Cobalt error payload to a canonical Tickless error code."""
    error = payload.get("error") or {}
    code = error.get("code") or "extract_failed"
    if code in {
        "invalid-url",
        "cobalt.service-unsupported",
        "service-unsupported",
        "unsupported-service",
    }:
        return "unsupported"
    if code in {
        "error.api.fetch.empty",
        "error.api.fetch.failed",
        "cobalt.post-not-found",
        "post-not-found",
    }:
        # Cobalt reached Instagram but got no media back. Common for
        # carousels/albums or posts Instagram is currently gating; not a
        # server outage, so tell the user it's this post, not the service.
        return "no_media"
    if code in {
        "cobalt.service-timedout",
        "service-timedout",
        "rate-limit",
        "ratelimit",
        "too-many-requests",
    }:
        return "extract_failed"
    # Codes that are already canonical Tickless codes (extractor_down,
    # extract_failed, ig_blocked, unavailable, ...) pass through unchanged.
    return code


def cobalt_extract(url: str, kind: str = "auto") -> dict[str, Any]:
    """Extract media via our own Cobalt instance.

    Returns a dict compatible with Tickless Result: title, author,
    duration, thumbnail, video_url, audio_url, width, height, platform.

    Raises ExtractionError on failure.
    """
    cobalt_url = os.getenv("COBALT_URL", "").rstrip("/")
    if not cobalt_url:
        raise ExtractionError("extract_failed")

    body: dict[str, Any] = {"url": url}
    if kind == "audio":
        body["downloadMode"] = "audio"
        body["audioFormat"] = "mp3"
    else:
        body["downloadMode"] = "auto"
        body["videoQuality"] = "1080"

    req = urllib.request.Request(
        f"{cobalt_url}/",
        data=json.dumps(body).encode(),
        headers=_headers(),
        method="POST",
    )

    # Wake a cold instance (polls until it responds; no-op once it's warm).
    # If it never came up, there is no point burning another ~12s of retry
    # backoff against a container that is not listening: fail fast with an
    # honest "warming up" code so the caller can tell the user to retry
    # shortly, rather than a generic outage message.
    if COBALT_WARMUP:
        if not _warm_up_cobalt(cobalt_url):
            raise ExtractionError("extractor_waking")

    last_exc: Exception | None = None
    for attempt in range(COBALT_MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=COBALT_TIMEOUT) as resp:
                data = json.loads(resp.read())
            break
        except urllib.error.HTTPError as e:
            # Cobalt returns structured errors as HTTP 400 (e.g.
            # error.api.fetch.empty for the Instagram login wall). Parse the
            # body and map to the canonical Tickless code instead of a generic
            # 500. A 5xx means the extractor service itself is down (often a
            # cold start) -> retry a few times; the warm-up poll brings it up.
            body = _read_body(e)
            last_exc = e
            if e.code >= 500:
                if attempt < COBALT_MAX_RETRIES - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
                raise ExtractionError("extractor_down") from e
            # 4xx: the body carries the real reason.
            if isinstance(body, dict) and body.get("status") == "error":
                raise ExtractionError(_canon_cobalt_error(body)) from e
            raise ExtractionError("extract_failed") from e
        except Exception as e:
            # Network failure / timeout reaching Cobalt -> service unavailable.
            last_exc = e
            if attempt < COBALT_MAX_RETRIES - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise ExtractionError("extractor_down") from e
    else:
        raise ExtractionError("extractor_down") from last_exc

    if not isinstance(data, dict):
        raise ExtractionError("extract_failed")

    status = data.get("status")
    if status == "error":
        raise ExtractionError(_canon_cobalt_error(data))

    if status in ("tunnel", "redirect"):
        filename = data.get("filename") or data.get("url", "video")
        # Cobalt now forwards Instagram post metadata (caption/author/cover)
        # on the response when present. Prefer it so the result card matches the
        # TikTok one (cover + caption + @author); fall back to the synthetic
        # filename title otherwise (e.g. single TikTok photo posts).
        return {
            "title": (data.get("title") or _clean_filename(filename))[:200],
            "author": data.get("author") or "",
            "duration": None,
            # `thumbnail` from Cobalt is the PUBLIC display_url (not the loopback
            # proxy), so it is safe to pass through directly.
            "thumbnail": data.get("thumbnail") or None,
            "video_url": data["url"],
            "audio_url": None,
            "width": None,
            "height": None,
        }

    if status == "picker":
        picker = data.get("picker") or []
        if not picker:
            raise ExtractionError("no_media")
        items = _normalize_media_items(picker)
        return _build_gallery_or_single(items, url, data)

    if status == "local-processing":
        tunnels = data.get("tunnel") or []
        if not tunnels:
            raise ExtractionError("extract_failed")
        output = data.get("output") or {}
        items = [
            {
                "url": t,
                "type": "video",
                "thumb": None,
                "width": None,
                "height": None,
            }
            for t in tunnels
            if "/audio/" not in t and "/gif/" not in t
        ]
        if not items:
            items = [
                {
                    "url": tunnels[0],
                    "type": "video",
                    "thumb": None,
                    "width": None,
                    "height": None,
                }
            ]
        return _build_gallery_or_single(items, url, data)

    raise ExtractionError("extract_failed")


def _pick_video_tunnel(tunnels: list[str]) -> str | None:
    for t in tunnels:
        if "/audio/" not in t and "/gif/" not in t:
            return t
    return None


def _normalize_media_items(picker: list[dict]) -> list[dict]:
    items: list[dict] = []
    for entry in picker:
        if not isinstance(entry, dict):
            continue
        url = entry.get("url")
        if not url:
            continue
        item_type = entry.get("type") or "video"
        if item_type not in {"photo", "video"}:
            item_type = "video"
        thumb = entry.get("thumb") or entry.get("thumbnail")
        width = entry.get("width") or entry.get("video_width")
        height = entry.get("height") or entry.get("video_height")
        if width is not None:
            try:
                width = int(width)
            except Exception:
                width = None
        if height is not None:
            try:
                height = int(height)
            except Exception:
                height = None
        items.append(
            {
                "url": url,
                "type": item_type,
                "thumb": thumb,
                "width": width,
                "height": height,
            }
        )
    return items


def _build_gallery_or_single(items: list[dict], url: str = "", data: dict | None = None) -> dict[str, Any]:
    if not items:
        raise ExtractionError("no_media")
    photo_count = sum(1 for item in items if item.get("type") == "photo")
    video_count = sum(1 for item in items if item.get("type") != "photo")

    data = data or {}

    # Use the post shortcode/id as the naming base so every file is unique
    # per post and reads cleanly (e.g. "Instagram post DbEgdzMDK4g" or
    # "TikTok post 7668704036874489108"), instead of an ugly "9 videos,
    # 1 photo" count phrase.
    code = _ig_shortcode(url) if "instagram" in (url or "") else None
    tt_code = None
    if not code and "tiktok" in (url or ""):
        tt_code = _tiktok_id(url) or _tiktok_id(_resolve_tiktok_short(url))

    # Cobalt now forwards Instagram post metadata (caption/author/cover) on the
    # response. When present, prefer it so the card matches the TikTok one
    # (cover + caption + @author). The forwarded `thumbnail` is the PUBLIC
    # display_url, so it is used directly (NOT run through _public_thumb, which
    # only filters loopback proxy URLs).
    fwd_title = (data.get("title") or "").strip()
    fwd_author = (data.get("author") or "").strip()
    fwd_thumb = data.get("thumbnail") or None

    if fwd_title:
        title = fwd_title[:200]
    elif code:
        title = f"Instagram post {code}"
    elif tt_code:
        title = f"TikTok post {tt_code}"
    else:
        title_parts = []
        if video_count:
            title_parts.append(f"{video_count} video" if video_count == 1 else f"{video_count} videos")
        if photo_count:
            title_parts.append(f"{photo_count} photo" if photo_count == 1 else f"{photo_count} photos")
        title = ", ".join(title_parts) or "Instagram post"

    author = fwd_author

    primary = next((item for item in items if item.get("type") == "video"), None) or items[0]
    all_urls = [item["url"] for item in items]
    all_types = [item.get("type", "video") for item in items]
    thumbs = [item.get("thumb") for item in items if item.get("thumb")]

    primary_type = primary.get("type", "video")
    result: dict[str, Any] = {
        "title": title[:200],
        "author": author,
        "duration": None,
        # Use the forwarded public cover when present; otherwise fall back to the
        # first item's thumb with loopback proxy URLs stripped (those are
        # 127.0.0.1 sidecar URLs the browser cannot reach).
        "thumbnail": fwd_thumb or _public_thumb(thumbs[0] if thumbs else primary.get("thumb")),
        "video_url": primary["url"],
        "audio_url": None,
        "width": primary.get("width"),
        "height": primary.get("height"),
        "gallery": all_urls if len(items) > 1 else None,
        "gallery_types": all_types if len(items) > 1 else None,
    }
    if primary_type == "photo":
        result["video_url"] = None
        result["photo_urls"] = all_urls
    elif photo_count:
        result["photo_urls"] = [item["url"] for item in items if item.get("type") == "photo"]
    return result


def _ig_shortcode(url: str) -> str | None:
    """Extract the Instagram post shortcode (p/..., reel/..., tv/...) for naming."""
    if not url:
        return None
    m = re.search(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def _public_thumb(url: str | None) -> str | None:
    """Drop thumbnail URLs the user's browser cannot reach.

    Cobalt now runs as a loopback sidecar, so its tunnel URLs point at
    127.0.0.1 (this container). A thumbnail is the one Cobalt URL the browser
    loads directly, so a loopback one would render broken. Public CDN
    thumbnails (Instagram/TikTok) are passed through untouched.
    """
    if not url:
        return None
    if re.match(r"https?://(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(?::\d+)?/", url):
        return None
    return url


def _tiktok_id(url: str) -> str | None:
    """Extract the TikTok post id from a /video/ or /photo/ URL for naming.

    Photo posts use /photo/<id>. Short links (vt./vm.tiktok.com) carry no id,
    so they are resolved first via `_resolve_tiktok_short`.
    """
    if not url:
        return None
    m = re.search(r"tiktok\.com/(?:@[\w.\-]+/)?(?:video|photo)/(\d+)", url)
    return m.group(1) if m else None


def _resolve_tiktok_short(url: str) -> str:
    """Follow a vt./vm.tiktok.com short link to its canonical URL.

    Only used to recover the post id for filenames, so any failure just
    returns the original URL and we fall back to the generic title.
    """
    if not re.search(r"(?:vt|vm)\.tiktok\.com/", url or ""):
        return url
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "Mozilla/5.0 (compatible; Tickless/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.url or url
    except Exception:
        return url


def _clean_filename(filename: str) -> str:
    name = filename.rsplit(".", 1)[0] if "." in filename else filename
    for sep in ("-", "_", "."):
        name = name.replace(sep, " ")
    name = " ".join(name.split())
    return name.strip() or "video"


def _metadata_artist(metadata: dict | None) -> str:
    if not metadata:
        return ""
    for key in ("artist", "composer", "uploader"):
        val = metadata.get(key)
        if val:
            return str(val).strip()
    return ""
