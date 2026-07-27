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
