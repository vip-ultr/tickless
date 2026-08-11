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
