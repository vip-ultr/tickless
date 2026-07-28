"""Tests for URL validation and live extraction."""
import pytest

from validation import normalize_and_validate
from extractor import extract, ExtractionError

LIVE_URL = "https://www.tiktok.com/@scout2015/video/6718335390845095173"


def test_rejects_empty():
    with pytest.raises(ValueError):
        normalize_and_validate("")


def test_rejects_non_tiktok():
    with pytest.raises(ValueError):
        normalize_and_validate("https://youtube.com/watch?v=x")


def test_rejects_too_long():
    with pytest.raises(ValueError):
        normalize_and_validate("https://tiktok.com/" + "a" * 600)


def test_accepts_full_link():
    assert normalize_and_validate(LIVE_URL) == LIVE_URL


def test_accepts_short_link_and_adds_scheme():
    out = normalize_and_validate("vm.tiktok.com/ZMabc123/")
    assert out.startswith("https://vm.tiktok.com/")


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
    utf8, ascii_ = build_download_filename("Scramble up ur name & I'll try to guess it", "Scout", "mp4")
    assert utf8 == "Scout - Scramble up ur name & I'll try to guess it - Tickless.mp4"
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


def test_filename_unicode_gets_ascii_fallback():
    utf8, ascii_ = build_download_filename("café vidéo 日本語", "ユーザー", "mp4")
    assert utf8 == "ユーザー - café vidéo 日本語 - Tickless.mp4"
    assert ascii_.isascii()
    assert ascii_.endswith("Tickless.mp4")


def test_filename_length_capped():
    utf8, _ = build_download_filename("x" * 300, "verylonguploader", "mp4")
    stem = utf8.rsplit(".", 1)[0]
    assert len(stem) <= 80 + len(" - Tickless")


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
