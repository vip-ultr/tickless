"""Cobalt API client for non-TikTok platforms."""
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from extractor import ExtractionError

COBALT_TIMEOUT = int(os.getenv("COBALT_TIMEOUT", "120"))


def _headers() -> dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


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
    try:
        with urllib.request.urlopen(req, timeout=COBALT_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        # 5xx from Cobalt (e.g. 502 Bad Gateway) means the extractor service
        # itself is down/unreachable, not a bad request. Surface a precise,
        # friendly code so the frontend can tell the user to retry shortly.
        code = "extractor_down" if e.code >= 500 else "extract_failed"
        raise ExtractionError(code) from e
    except Exception as e:
        # Network failure / timeout reaching Cobalt -> service unavailable.
        raise ExtractionError("extractor_down") from e

    if not isinstance(data, dict):
        raise ExtractionError("extract_failed")

    status = data.get("status")
    if status == "error":
        error = data.get("error") or {}
        code = error.get("code") or "extract_failed"
        # Canonicalise Cobalt error codes to Tickless codes.
        if code in {
            "invalid-url",
            "cobalt.service-unsupported",
            "service-unsupported",
            "unsupported-service",
        }:
            code = "unsupported"
        elif code in {
            "cobalt.service-timedout",
            "service-timedout",
            "rate-limit",
            "ratelimit",
            "too-many-requests",
        }:
            code = "extract_failed"
        raise ExtractionError(code)

    if status in ("tunnel", "redirect"):
        filename = data.get("filename") or data.get("url", "video")
        return {
            "title": _clean_filename(filename)[:200],
            "author": "",
            "duration": None,
            "thumbnail": None,
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
        return _build_gallery_or_single(items, url)

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
        return _build_gallery_or_single(items, url)

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


def _build_gallery_or_single(items: list[dict], url: str = "") -> dict[str, Any]:
    if not items:
        raise ExtractionError("no_media")
    photo_count = sum(1 for item in items if item.get("type") == "photo")
    video_count = sum(1 for item in items if item.get("type") != "photo")

    # Use the Instagram post shortcode as the naming base so every file is
    # unique per post and reads cleanly (e.g. "Instagram post DbEgdzMDK4g"),
    # instead of an ugly "9 videos, 1 photo" count phrase.
    code = _ig_shortcode(url) if "instagram" in (url or "") else None
    if code:
        title = f"Instagram post {code}"
    else:
        title_parts = []
        if video_count:
            title_parts.append(f"{video_count} video" if video_count == 1 else f"{video_count} videos")
        if photo_count:
            title_parts.append(f"{photo_count} photo" if photo_count == 1 else f"{photo_count} photos")
        title = ", ".join(title_parts) or "Instagram post"

    primary = next((item for item in items if item.get("type") == "video"), None) or items[0]
    all_urls = [item["url"] for item in items]
    all_types = [item.get("type", "video") for item in items]
    thumbs = [item.get("thumb") for item in items if item.get("thumb")]

    primary_type = primary.get("type", "video")
    result: dict[str, Any] = {
        "title": title[:200],
        "author": "",
        "duration": None,
        "thumbnail": thumbs[0] if thumbs else primary.get("thumb"),
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
