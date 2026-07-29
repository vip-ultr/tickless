"""Cobalt API client for non-TikTok platforms."""
import importlib.util
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


_BACKEND_DIR = Path(__file__).resolve().parent
_EXTRACTOR_PATH = _BACKEND_DIR / "extractor.py"

_spec = importlib.util.spec_from_file_location("tickless_extractor", _EXTRACTOR_PATH)
_extractor_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_extractor_mod)
ExtractionError = _extractor_mod.ExtractionError

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
        raise ExtractionError("extract_failed") from e
    except Exception as e:
        raise ExtractionError("extract_failed") from e

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
        first = picker[0]
        if first.get("url"):
            return cobalt_extract(first["url"], kind)
        raise ExtractionError("no_media")

    if status == "local-processing":
        tunnels = data.get("tunnel") or []
        if not tunnels:
            raise ExtractionError("extract_failed")
        tunnel = _pick_video_tunnel(tunnels) or tunnels[0]
        output = data.get("output") or {}
        return {
            "title": (output.get("filename") or "video")[:200],
            "author": _metadata_artist(output.get("metadata")),
            "duration": None,
            "thumbnail": None,
            "video_url": tunnel,
            "audio_url": None,
            "width": None,
            "height": None,
        }

    raise ExtractionError("extract_failed")


def _pick_video_tunnel(tunnels: list[str]) -> str | None:
    for t in tunnels:
        if "/audio/" not in t and "/gif/" not in t:
            return t
    return None


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
