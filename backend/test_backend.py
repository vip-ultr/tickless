"""Tests for URL validation and live extraction."""
import os as _os

import pytest

from validation import normalize_and_validate
from extractor import extract, ExtractionError

LIVE_URL = "https://www.tiktok.com/@scout2015/video/6718335390845095173"


def test_rejects_empty():
    with pytest.raises(ValueError):
        normalize_and_validate("")


def test_rejects_non_tiktok():
    with pytest.raises(ValueError):
        normalize_and_validate("https://facebook.com/watch/?v=1")


def test_rejects_too_long():
    with pytest.raises(ValueError):
        normalize_and_validate("https://tiktok.com/" + "a" * 600)


def test_accepts_full_link():
    url, platform = normalize_and_validate(LIVE_URL)
    assert url == LIVE_URL
    assert platform == "tiktok"


def test_accepts_short_link_and_adds_scheme():
    url, platform = normalize_and_validate("vm.tiktok.com/ZMabc123/")
    assert url.startswith("https://vm.tiktok.com/")
    assert platform == "tiktok"


def test_detects_instagram():
    for raw in (
        "https://www.instagram.com/reel/Cabc123xyz/",
        "instagram.com/p/Cabc123xyz/",
        "https://instagr.am/reel/Cabc123xyz/",
        "https://m.instagram.com/reels/Cabc123xyz/",
    ):
        url, platform = normalize_and_validate(raw)
        assert platform == "instagram", raw
        assert url.startswith("https://")


def test_detects_youtube():
    for raw in (
        "https://www.youtube.com/watch?v=abc123",
        "https://youtu.be/abc123",
        "https://m.youtube.com/watch?v=abc123",
        "https://music.youtube.com/watch?v=abc123",
    ):
        url, platform = normalize_and_validate(raw)
        assert platform == "youtube", raw
        assert url.startswith("https://")


def test_rejects_unsupported_hosts():
    for raw in (
        "https://facebook.com/watch/?v=1",
        "https://x.com/user/status/1",
        "https://nottiktok.com/video/1",
        "https://tiktok.com.evil.com/video/1",
    ):
        with pytest.raises(ValueError):
            normalize_and_validate(raw)


@pytest.mark.live
def test_live_extraction():
    """Real extraction. Doubles as the yt-dlp health check. Needs network."""
    data = extract(LIVE_URL)
    assert data["video_url"]
    assert data["author"] == "scout2015"
    assert data["duration"] == 10


# ---- download filename builder ----
from main import build_download_filename


def test_filename_basic():
    utf8, ascii_ = build_download_filename(
        "Scramble up ur name & I'll try to guess it", "Scout", "mp4"
    )
    # Caption portion is capped at 40 chars total (uploader + caption), then
    # " - Tickless" appended. The exact truncation point depends on the
    # uploader prefix length, so assert the shape, not the exact cut.
    assert utf8.startswith("Scout - Scramble up ur name")
    assert utf8.endswith(" - Tickless.mp4")
    assert len(utf8) <= 40 + len(" - Tickless.mp4")
    assert ascii_ == utf8  # already ascii


def test_filename_strips_hashtags_and_forbidden_chars():
    utf8, _ = build_download_filename('cool video #fyp #viral <>:"/\\|?*', "user", "mp4")
    assert "#" not in utf8
    for ch in '<>:"/\\|?*':
        assert ch not in utf8
    assert utf8.startswith("user - cool video")
    assert utf8.endswith(" - Tickless.mp4")


def test_filename_empty_title_falls_back():
    utf8, _ = build_download_filename("", "", "mp4")
    assert utf8 == "tiktok video - Tickless.mp4"
    utf8a, _ = build_download_filename("#onlyhashtags #fyp", "", "mp3")
    assert utf8a == "tiktok audio - Tickless.mp3"


def test_filename_empty_title_falls_back_for_youtube():
    utf8v, _ = build_download_filename("", "", "mp4", platform="youtube")
    assert utf8v == "youtube video - Tickless.mp4"
    utf8a, _ = build_download_filename("", "", "mp3", platform="youtube")
    assert utf8a == "youtube audio - Tickless.mp3"


def test_filename_unicode_gets_ascii_fallback():
    utf8, ascii_ = build_download_filename("café vidéo 日本語", "ユーザー", "mp4")
    # Caption portion capped at 40 chars, then " - Tickless" appended.
    assert utf8.startswith("ユーザー - café vidéo 日本語")
    assert utf8.endswith(" - Tickless.mp4")
    assert ascii_.isascii()
    assert ascii_.endswith("Tickless.mp4")


def test_filename_length_capped():
    utf8, _ = build_download_filename("x" * 300, "verylonguploader", "mp4")
    stem = utf8.rsplit(".", 1)[0]
    assert len(stem) <= 40 + len(" - Tickless")


def test_filename_gallery_index_survives_long_caption():
    # Regression: the per-gallery _N suffix must be appended AFTER the caption
    # cap, so multi-image posts get unique filenames even with long captions.
    long_caption = "Mutlu pazarlar pazar modunuz hangisi 1,2,…12? Photo credit @byhake & @numanuk #pazarkeyfi"
    base, _ = build_download_filename(long_caption, "hergun1yer", "jpg", index=0)
    second, _ = build_download_filename(long_caption, "hergun1yer", "jpg", index=1)
    assert base != second
    assert base.endswith("_1 - Tickless.jpg")
    assert second.endswith("_2 - Tickless.jpg")
    # Index suffix is not truncated away by the 40-char caption cap.
    assert "_1" in base and "_2" in second


# ---- visit analytics ----
from analytics import visitor_hash


def test_visitor_hash_stable_within_day():
    assert visitor_hash("1.2.3.4") == visitor_hash("1.2.3.4")


def test_visitor_hash_differs_per_ip():
    assert visitor_hash("1.2.3.4") != visitor_hash("5.6.7.8")


def test_visitor_hash_no_raw_ip():
    h = visitor_hash("203.0.113.77")
    assert "203" not in h or "203.0.113.77" not in h
    assert len(h) == 32


# ---- instagram ----
def test_ig_blocked_maps_to_clean_error():
    """Without IG_SESSIONID, IG extraction must fail with ig_blocked, not a raw 500."""
    if _os.getenv("IG_SESSIONID"):
        pytest.skip("IG session configured; blocked-path not applicable")
    with pytest.raises(ExtractionError) as exc:
        extract("https://www.instagram.com/reel/C-5oXanSnQY/")
    assert exc.value.code in ("ig_blocked", "unavailable", "extract_failed")


def test_youtube_bot_wall_fallback_present_in_code():
    """YouTube bot-wall fallback should exist in extractor.py without real network."""
    src = open(_os.path.join(_os.path.dirname(__file__), "extractor.py"), encoding="utf-8").read()
    assert "_yt_browser_fallback_opts" in src
    assert '_is_youtube_url(url) and "not a bot" in msg' in src
    assert "YOUTUBE_COOKIE" in src


def test_cobalt_picker_multi_item_photo_and_video(monkeypatch, tmp_path):
    """Instagram carousel and photo-only posts should surface all URLs."""

    def fake_urlopen(req, timeout=None):
        import json
        from urllib.request import Request
        # The cold-start warmup probes with a plain URL string (no .data),
        # while the real extraction passes a Request with a JSON body.
        # Answer the warmup probe as "awake" so the test exercises the
        # extraction path rather than the spin-down path.
        data = getattr(req, "data", None)
        body = json.loads(data.decode()) if data else {}
        url = body.get("url", "")
        if "DbEgdzMDK4g" in url:
            payload = {
                "status": "picker",
                "picker": [
                    {
                        "type": "video",
                        "url": "https://example.com/v1.mp4",
                        "thumb": "https://example.com/t1.jpg",
                        "width": 1080,
                        "height": 1920,
                    },
                    {
                        "type": "video",
                        "url": "https://example.com/v2.mp4",
                        "thumb": "https://example.com/t2.jpg",
                    },
                    {
                        "type": "photo",
                        "url": "https://example.com/p1.jpg",
                        "thumb": "https://example.com/tp1.jpg",
                    },
                    {
                        "type": "photo",
                        "url": "https://example.com/p2.jpg",
                    },
                ],
            }
        elif "DbRkanLiFzI" in url:
            payload = {
                "status": "picker",
                "picker": [
                    {
                        "type": "photo",
                        "url": "https://example.com/pa.jpg",
                        "thumb": "https://example.com/ta.jpg",
                    }
                ],
            }
        else:
            payload = {
                "status": "error",
                "error": {"code": "invalid-url"},
            }

        class FakeResp:
            def read(self):
                return json.dumps(payload).encode()

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

        return FakeResp()

    import cobalt_client as _cc
    monkeypatch.setenv("COBALT_URL", "https://tickless-cobalt.onrender.com")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    import importlib
    importlib.reload(_cc)

    multi = _cc.cobalt_extract(
        "https://www.instagram.com/p/DbEgdzMDK4g/?img_index=2&igsh=MXR6NTR3Y25jdTdicw=="
    )
    assert multi["video_url"].endswith("v1.mp4"), multi
    assert multi["photo_urls"] == [
        "https://example.com/p1.jpg",
        "https://example.com/p2.jpg",
    ], multi
    assert multi["gallery"] == [
        "https://example.com/v1.mp4",
        "https://example.com/v2.mp4",
        "https://example.com/p1.jpg",
        "https://example.com/p2.jpg",
    ], multi
    assert multi["gallery_types"] == ["video", "video", "photo", "photo"], multi
    assert multi["thumbnail"] == "https://example.com/t1.jpg", multi

    photo_only = _cc.cobalt_extract(
        "https://www.instagram.com/p/DbRkanLiFzI/?img_index=1&igsh=MWExNTRiM29yenc0dQ=="
    )
    assert photo_only["video_url"] is None, photo_only
    assert photo_only["photo_urls"] == ["https://example.com/pa.jpg"], photo_only
    assert photo_only["thumbnail"] == "https://example.com/ta.jpg", photo_only


def test_cobalt_single_instagram_photo_redirect_is_proxyable(monkeypatch):
    """A single-image Instagram post returns a `redirect` with a PUBLIC image
    CDN url (not Cobalt's loopback tunnel). Tickless proxies it through the
    backend, so it must surface as a photo with no video_url and must NOT be a
    127.0.0.1 loopback url the browser/backend can't reach."""

    def fake_urlopen(req, timeout=None):
        import json
        from urllib.request import Request
        data = getattr(req, "data", None)
        body = json.loads(data.decode()) if data else {}
        url = body.get("url", "")
        if "DcY2PLORchJ" in url:
            payload = {
                "status": "redirect",
                "url": "https://instagram.fna.fbcdn.net/v/t51.82787-15/photo_n.jpg?oh=abc",
                "filename": "instagram_DcY2PLORchJ.jpg",
                "title": "My single beach photo",
                "author": "someuser",
                "thumbnail": "https://instagram.fna.fbcdn.net/v/cover.jpg",
            }
        else:
            payload = {"status": "error", "error": {"code": "invalid-url"}}

        class FakeResp:
            def read(self):
                return json.dumps(payload).encode()

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

        return FakeResp()

    import cobalt_client as _cc
    monkeypatch.setenv("COBALT_URL", "https://tickless-cobalt.onrender.com")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    import importlib
    importlib.reload(_cc)

    single = _cc.cobalt_extract(
        "https://www.instagram.com/p/DcY2PLORchJ/?igsi=MWRoNWllMG5wNzRuZQ=="
    )
    assert single["video_url"] is None, single
    assert single["photo_urls"] == [
        "https://instagram.fna.fbcdn.net/v/t51.82787-15/photo_n.jpg?oh=abc"
    ], single
    assert single["gallery_types"] == ["photo"], single
    assert single["title"] == "My single beach photo", single
    assert single["author"] == "someuser", single
    # Must be a public url the backend can proxy, NOT a loopback tunnel.
    assert "127.0.0.1" not in single["photo_urls"][0], single
    assert "localhost" not in single["photo_urls"][0], single


@pytest.mark.live
def test_live_instagram_extraction():
    """Only runs when an IG session cookie is configured."""
    if not _os.getenv("IG_SESSIONID"):
        pytest.skip("IG_SESSIONID not set")
    data = extract("https://www.instagram.com/reel/DTiy8MKEqux/")
    assert data["video_url"]


# cobalt routing tests are in test_cobalt.py and verified by integration scripts.


def test_unsupported_url_maps_to_use_cobalt():
    """TikTok /photo/ posts make yt-dlp raise 'Unsupported URL'. That must
    become the use_cobalt routing signal (so we fall back to Cobalt), not a
    generic extract_failed 502.

    Code-contract test: no network, just assert the mapping exists in both
    extract() and download_media().
    """
    import os as _os
    src = open(_os.path.join(_os.path.dirname(__file__), "extractor.py")).read()
    assert '"unsupported url" in msg' in src
    assert '"unsupported url" in str(e).lower()' in src
    assert src.count('ExtractionError("use_cobalt")') >= 3
    # The classified error must be re-raised before the generic handler
    # flattens it into extract_failed.
    assert "except ExtractionError:" in src


def test_main_routes_use_cobalt_to_cobalt():
    """/api/extract, /api/download, and /api/clip must fall back to Cobalt when
    yt-dlp reports use_cobalt (TikTok photo posts)."""
    import os as _os
    src = open(_os.path.join(_os.path.dirname(__file__), "main.py")).read()
    assert src.count('e.code != "use_cobalt"') == 3


def test_health_cobalt_reports_down_when_sidecar_unreachable(monkeypatch):
    """The sidecar can die while the backend stays up. /api/health still says
    "ok" in that state, so Instagram would break silently — hence a dedicated
    probe. Port 9 (discard) stands in for a dead sidecar.
    """
    from fastapi.testclient import TestClient

    import main as main_mod

    monkeypatch.setenv("COBALT_URL", "http://127.0.0.1:9")
    with TestClient(main_mod.app) as c:
        r = c.get("/api/health/cobalt")
    assert r.status_code == 503
    assert r.json()["status"] == "down"


def test_health_cobalt_requires_configuration(monkeypatch):
    from fastapi.testclient import TestClient

    import main as main_mod

    monkeypatch.setenv("COBALT_URL", "")
    with TestClient(main_mod.app) as c:
        r = c.get("/api/health/cobalt")
    assert r.status_code == 503
    assert "not configured" in r.json()["error"]
