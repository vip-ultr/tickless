"""Tests for the clip feature (manual trim + audio-only).

ffmpeg is only present in the deployed image, not on every dev box, so the
real trim/stream tests are guarded by ffmpeg availability and SKIP locally.
The validation + API-shape tests run everywhere.
"""
import os
import shutil

import pytest

import clipper


HAS_FFMPEG = clipper.ffmpeg_path() is not None


def _make_fake_video(path: str, seconds: float = 3.0):
    """Create a tiny real mp4 via ffmpeg if available, else skip the caller."""
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg not installed in this environment")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    import subprocess
    cmd = [
        clipper.ffmpeg_path(),
        "-f", "lavfi", "-i", "testsrc=duration=%.1f:size=320x240:rate=10" % seconds,
        "-f", "lavfi", "-i", "sine=frequency=440:duration=%.1f" % seconds,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", path,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-400:]
    assert os.path.isfile(path)


# ---------------------------------------------------------- pure unit (no ffmpeg)

def test_clamp_segment_valid():
    assert clipper._clamp_segment(1.0, 5.0) == (1.0, 5.0)


def test_clamp_segment_negative_start_clamped():
    # Negative start is clamped to 0 (not rejected).
    assert clipper._clamp_segment(-2.0, 4.0) == (0.0, 4.0)


@pytest.mark.parametrize("start,end", [(5.0, 1.0), (2.0, 2.0)])
def test_clamp_segment_invalid(start, end):
    with pytest.raises(ValueError):
        clipper._clamp_segment(start, end)


def test_park_and_resolve_token(tmp_path):
    token = "abc123"
    d = clipper.park_upload(token, "clip.mp4")
    src = os.path.join(d, "source.mp4")
    open(src, "w").write("x")
    assert clipper.source_path_for_token(token) == src
    # path traversal must be rejected
    assert clipper.source_path_for_token("../evil") is None
    assert clipper.source_path_for_token("") is None


# ---------------------------------------------------------- API shape (no ffmpeg)

def test_clip_requires_source_or_token(client):
    r = client.post("/api/clip", json={"start": 0, "end": 2}, headers=_hdr())
    assert r.status_code == 400


def test_clip_rejects_both(client):
    r = client.post(
        "/api/clip",
        json={"token": "x", "source_url": "https://tiktok.com/@a/video/1", "start": 0, "end": 2},
        headers=_hdr(),
    )
    assert r.status_code == 400


def test_clip_invalid_segment(client, tmp_path):
    # Park a fake source so token resolution succeeds, then send a bad segment.
    token = "tok123"
    d = clipper.park_upload(token, "v.mp4")
    open(os.path.join(d, "source.mp4"), "w").write("x")
    r = client.post(
        "/api/clip", json={"token": token, "start": 5, "end": 1}, headers=_hdr()
    )
    assert r.status_code == 400


def test_clip_unknown_token(client):
    r = client.post(
        "/api/clip", json={"token": "nope", "start": 0, "end": 2}, headers=_hdr()
    )
    assert r.status_code == 404


def test_upload_rejects_non_video(client, tmp_path):
    # A tiny text "image" upload must be rejected before any disk write.
    import io
    files = {"file": ("note.txt", io.BytesIO(b"hello"), "text/plain")}
    r = client.post("/api/clip/upload", files=files, headers=_hdr())
    assert r.status_code == 400


# ---------------------------------------------------------- real trim (needs ffmpeg)

def test_clip_trim_video(client, tmp_path):
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg not installed in this environment")
    # Build a real 3s source, park it, trim [0.5, 2.0] -> expect ~1.5s clip.
    src_dir = os.path.join(tmp_path, "upload")
    token = "real1"
    d = clipper.park_upload(token, "v.mp4")
    source = os.path.join(d, "source.mp4")
    _make_fake_video(source, seconds=3.0)

    r = client.post(
        "/api/clip",
        json={"token": token, "start": 0.5, "end": 2.0, "audio_only": False},
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text
    data = r.content
    assert len(data) > 0
    # Write to disk and probe duration with ffprobe if available.
    out = os.path.join(tmp_path, "out.mp4")
    open(out, "wb").write(data)
    dur = clipper.ffprobe_duration(out)
    assert dur is not None
    # Allow generous ffmpeg tolerance around 1.5s.
    assert 1.0 <= dur <= 2.2, f"clip duration was {dur}"


def test_clip_audio_only(client, tmp_path):
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg not installed in this environment")
    token = "real2"
    d = clipper.park_upload(token, "v.mp4")
    source = os.path.join(d, "source.mp4")
    _make_fake_video(source, seconds=2.0)

    r = client.post(
        "/api/clip",
        json={"token": token, "start": 0.0, "end": 1.5, "audio_only": True},
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "audio/mpeg"
    out = os.path.join(tmp_path, "out.mp3")
    open(out, "wb").write(r.content)
    # mp3 should have no video stream.
    probe = shutil.which("ffprobe")
    assert probe is not None
    import subprocess
    res = subprocess.run(
        [probe, "-v", "error", "-select_streams", "v", "-show_entries",
         "stream=index", "-of", "csv=p=0", out],
        capture_output=True, text=True,
    )
    assert res.stdout.strip() == "", "audio-only clip must not contain a video stream"


def _hdr():
    # Mirror how the app checks: if API_KEY is configured (local .env / prod),
    # send it; if not (CI), send nothing and the app allows.
    key = os.getenv("TICKLESS_API_KEY", "")
    return {"X-Tickless-Key": key} if key else {}


def test_clip_get_native_download(client, tmp_path):
    """GET (query params) must stream the clip so a native <a href> download
    works in the browser. The frontend switched away from fetch->blob->click,
    which silently failed because the click was outside a user gesture."""
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg not installed in this environment")
    token = "realget"
    d = clipper.park_upload(token, "v.mp4")
    _make_fake_video(os.path.join(d, "source.mp4"), seconds=2.0)
    r = client.get(
        f"/api/clip?token={token}&start=0&end=1.5&audio_only=false",
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-disposition"].startswith("attachment")
    assert r.headers["content-type"] == "video/mp4"
    assert len(r.content) > 0


# ---------------------------------------------------- carousels (no ffmpeg, no network)

IG_CAROUSEL = "https://www.instagram.com/p/DdxDDh5iGKH/?stkn=YTVjOTBmdGluM2d6"


def _mixed_carousel() -> dict:
    """The shape Cobalt really returns for a mixed Instagram carousel: the only
    video sits at slide 3 and everything around it is a photo."""
    return {
        "title": "hate me or love me",
        "author": "lamineyamal",
        "duration": None,
        "thumbnail": None,
        "video_url": "https://cdn.example/v3.mp4",
        "audio_url": None,
        "width": None,
        "height": None,
        "gallery": [
            "https://cdn.example/s1.jpg",
            "https://cdn.example/s2.jpg",
            "https://cdn.example/s3.mp4",
            "https://cdn.example/s4.jpg",
            "https://cdn.example/s5.jpg",
        ],
        "gallery_types": ["photo", "photo", "video", "photo", "photo"],
    }


@pytest.fixture
def carousel(monkeypatch):
    """Fake the whole Instagram path: Cobalt metadata, the CDN fetch, the trim.

    Records every URL actually fetched so a test can assert WHICH slide was
    used, and gives the fetched file the extension the real proxy derives from
    the response content-type, so the endpoint's photo guard sees the truth.
    """
    fetched: list[str] = []

    def fake_cobalt_extract(url):
        return _mixed_carousel()

    async def fake_proxy(url, dest_dir):
        fetched.append(url)
        ext = ".mp4" if url.endswith(".mp4") else ".jpg"
        path = os.path.join(dest_dir, f"source{ext}")
        with open(path, "wb") as f:
            f.write(b"\x00\x00\x00\x18ftypmp42")
        return path

    def fake_trim(src, start, end, out, audio_only):
        with open(out, "wb") as f:
            f.write(b"clip")

    monkeypatch.setattr("main.cobalt_extract", fake_cobalt_extract)
    monkeypatch.setattr("main._proxy_remote_media", fake_proxy)
    monkeypatch.setattr("main.trim_segment", fake_trim)
    return fetched


def test_clip_trims_the_slide_the_user_picked(client, carousel):
    """The point of the fix: gallery_index picks the slide, and the slide shown
    in the preview is the slide that gets trimmed."""
    r = client.get(
        f"/api/clip?source_url={IG_CAROUSEL}&start=0&end=1&gallery_index=2",
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text
    assert carousel == ["https://cdn.example/s3.mp4"], carousel


def test_clip_refuses_a_photo_slide(client, carousel):
    """With no index this lands on slide 1, which is a photo. A photo has no
    stream to trim, so it must come back as a clean 400 rather than an
    ffmpeg 502."""
    r = client.get(
        f"/api/clip?source_url={IG_CAROUSEL}&start=0&end=1", headers=_hdr()
    )
    assert r.status_code == 400, r.text


def test_clip_out_of_range_index_is_clamped_not_500(client, carousel):
    """An index past the end clamps to the last slide instead of erroring."""
    r = client.get(
        f"/api/clip?source_url={IG_CAROUSEL}&start=0&end=1&gallery_index=99",
        headers=_hdr(),
    )
    assert carousel == ["https://cdn.example/s5.jpg"], carousel
    assert r.status_code == 400, r.text  # last slide is a photo, so refused


def test_clip_filename_carries_the_slide_number(client, carousel):
    """Two clips trimmed from different slides must not save as the same name."""
    r = client.get(
        f"/api/clip?source_url={IG_CAROUSEL}&start=0&end=1&gallery_index=2",
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text
    assert "_3 - Tickless.mp4" in r.headers["content-disposition"], r.headers


def test_clip_instagram_never_touches_ytdlp(client, carousel, monkeypatch):
    """Instagram is rate-limited on yt-dlp from this IP: routing through it is
    what made every Instagram clip answer 502 while its preview worked."""

    def _boom(*a, **k):
        raise AssertionError("yt-dlp must not be used for an Instagram clip")

    monkeypatch.setattr("main.download_media", _boom)
    r = client.get(
        f"/api/clip?source_url={IG_CAROUSEL}&start=0&end=1&gallery_index=2",
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text


def test_clip_single_video_post_keeps_its_old_filename(client, monkeypatch):
    """A non-carousel post must be byte-for-byte what it was before carousels:
    no index, no _N suffix, still 200."""
    data = _mixed_carousel()
    data["gallery"] = None
    data["gallery_types"] = None

    async def fake_proxy(url, dest_dir):
        path = os.path.join(dest_dir, "source.mp4")
        with open(path, "wb") as f:
            f.write(b"\x00\x00\x00\x18ftypmp42")
        return path

    monkeypatch.setattr("main.cobalt_extract", lambda url: data)
    monkeypatch.setattr("main._proxy_remote_media", fake_proxy)
    monkeypatch.setattr(
        "main.trim_segment", lambda s, a, b, o, au: open(o, "wb").write(b"clip")
    )

    r = client.get(
        f"/api/clip?source_url={IG_CAROUSEL}&start=0&end=1", headers=_hdr()
    )
    assert r.status_code == 200, r.text
    assert "hate me or love me - Tickless.mp4" in r.headers["content-disposition"]


def test_clip_tiktok_still_uses_ytdlp(client, monkeypatch):
    """Regression guard: only Instagram moved to Cobalt. TikTok and YouTube
    keep the yt-dlp path that already worked."""

    def fake_download_media(url, dest_dir, kind="video"):
        path = os.path.join(dest_dir, "source.mp4")
        with open(path, "wb") as f:
            f.write(b"x")
        return path, "tiktok title", "uploader"

    monkeypatch.setattr("main.download_media", fake_download_media)
    monkeypatch.setattr(
        "main.trim_segment", lambda s, a, b, o, au: open(o, "wb").write(b"clip")
    )

    r = client.post(
        "/api/clip",
        json={"source_url": "https://tiktok.com/@a/video/1", "start": 0, "end": 1},
        headers=_hdr(),
    )
    assert r.status_code == 200, r.text
    assert "tiktok title - Tickless.mp4" in r.headers["content-disposition"]
