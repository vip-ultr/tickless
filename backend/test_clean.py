"""Tests for the Clean feature (AI metadata stripping).

ExifTool is installed in the deployed image (see Dockerfile) but not on every
dev box, so the real strip tests SKIP when it is absent. The validation and
API-shape tests run everywhere, mirroring test_clip.py's convention.
"""
import os
import subprocess

import pytest

import cleaner


HAS_EXIFTOOL = cleaner.exiftool_path() is not None
HAS_FFMPEG = __import__("shutil").which("ffmpeg") is not None


def _hdr():
    # Mirror how the app checks: if API_KEY is configured (local .env / prod),
    # send it; if not (CI), send nothing and the app allows.
    key = os.getenv("TICKLESS_API_KEY", "")
    return {"X-Tickless-Key": key} if key else {}


def _make_image(path: str, ext: str = "jpg"):
    """Create a tiny real image via ffmpeg, or skip the caller."""
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg not installed in this environment")
    cmd = [
        "ffmpeg", "-f", "lavfi",
        "-i", "color=c=red:s=64x64:d=1",
        "-frames:v", "1", "-y", path,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-400:]
    assert os.path.isfile(path)


def _et(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [cleaner.exiftool_path(), *args], capture_output=True, text=True
    )


def _write_ai_xmp(path: str):
    """Give a file the IPTC 'made with AI' label that platforms read."""
    r = _et(
        "-XMP:DigitalSourceType=trainedAlgorithmicMedia",
        "-overwrite_original", path,
    )
    assert r.returncode == 0, (r.stdout, r.stderr)


def _write_camera_tags(path: str):
    """Give a file the camera EXIF AI-only mode promises to preserve."""
    r = _et(
        "-Make=TestCam", "-Model=X1",
        "-GPSLatitude=51.5", "-GPSLatitudeRef=N",
        "-GPSLongitude=-0.1", "-GPSLongitudeRef=W",
        "-overwrite_original", path,
    )
    assert r.returncode == 0, (r.stdout, r.stderr)


# ---------------------------------------------------------- pure unit (no tools)

@pytest.mark.parametrize(
    "name,expected",
    [
        ("clip.mp4", "mp4"),
        ("photo.JPEG", "jpeg"),
        ("noext", ""),
        ("a.b.heic", "heic"),
        ("", ""),
        ("../../etc/passwd", ""),
    ],
)
def test_extension_of(name, expected):
    assert cleaner.extension_of(name) == expected


def test_supported_extensions_cover_everything_the_copy_promises():
    # docs/content.md section 11 names these exact types in the drop-zone hint
    # and in the unsupported-type error message. Both must stay in sync.
    for ext in ("mp4", "mov", "jpg", "png", "webp", "heic", "avif", "mp3"):
        assert ext in cleaner.SUPPORTED_EXTS, ext
    assert cleaner.SUPPORTED_EXTS["mp3"] == "audio/mpeg"


def test_is_supported_rejects_executables():
    for name in ("evil.sh", "payload.exe", "archive.zip", "x", "mp4"):
        assert not cleaner.is_supported(name), name


def test_ai_strip_flags_are_only_verified_names():
    """Regression guard for the trap that motivated cleaner.py's docstring.

    ExifTool silently downgrades an unknown flag to a warning and still exits
    0, so a 'working' command can be silently doing nothing. These names were
    each verified against a real build; the ones that do not exist must never
    come back.
    """
    flags = set(cleaner.AI_STRIP_FLAGS)
    for bogus in (
        "-C2PA:all=", "-CBOR:all=", "-PNG-text:parameters=",
        "-XMP:prompt=", "-XMP:steps=", "-XMP:sampler=", "-XMP:lora=",
        "-XMP:controlnet=", "-XMP:vae=", "-XMP-dc:DigitalSourceType=",
    ):
        assert bogus not in flags, bogus
    assert "-JUMBF:all=" in flags


def test_clean_output_name():
    from main import _clean_output_name

    assert _clean_output_name("holiday.mp4", "mp4") == "holiday-clean.mp4"
    assert _clean_output_name("no extension", "png") == "no extension-clean.png"
    # Header-safe: quotes and path separators must not survive into the
    # filename= parameter of Content-Disposition.
    hostile = _clean_output_name('we"ird/../x.mov', "mov")
    assert '"' not in hostile and "/" not in hostile
    # Falls back when nothing usable is left.
    assert _clean_output_name("...", "jpg") == "tickless-clean.jpg"


# ---------------------------------------------------------- API shape (no tools)

def test_clean_rejects_unsupported_type(client):
    r = client.post(
        "/api/clean",
        files={"file": ("evil.sh", b"#!/bin/sh", "application/x-sh")},
        headers=_hdr(),
    )
    assert r.status_code == 400
    # The backend's `detail` IS the user-facing copy; it is rendered verbatim.
    assert r.json()["detail"] == (
        "That file type is not supported. Try an MP4, MOV, JPEG, PNG, "
        "WebP, HEIC, AVIF, or MP3."
    )


def test_clean_rejects_empty_file(client):
    r = client.post(
        "/api/clean",
        files={"file": ("photo.jpg", b"", "image/jpeg")},
        headers=_hdr(),
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "That file is empty."


def test_clean_copy_has_no_em_dashes():
    """docs/content.md copy rules: no em-dashes, no AI-filler phrases."""
    from main import CLEAN_MESSAGES

    banned = ("—", "empower", "seamlessly", "unlock", "elevate")
    for message in CLEAN_MESSAGES.values():
        for word in banned:
            assert word not in message, (word, message)


# ---------------------------------------------------------- real strip (needs exiftool)

@pytest.mark.skipif(not HAS_EXIFTOOL, reason="exiftool not installed")
def test_strip_removes_ai_source_label(tmp_path):
    src = str(tmp_path / "in.jpg")
    out = str(tmp_path / "out.jpg")
    _make_image(src)
    _write_ai_xmp(src)

    assert cleaner.inspect(src)["tags"] > 0, "fixture should carry AI metadata"

    result = cleaner.strip_ai(src, out)

    assert result["had_ai"] is True
    assert result["removed"] > 0
    # The label itself must be gone.
    r = _et("-XMP-iptcExt:all", "-s", out)
    assert r.stdout.strip() == "", r.stdout


@pytest.mark.skipif(not HAS_EXIFTOOL, reason="exiftool not installed")
def test_strip_preserves_camera_exif_and_gps(tmp_path):
    """The core promise of AI-only mode: camera data survives.

    docs/content.md and the Clean page both claim the picture and sound are
    untouched, so this is the assertion that keeps the copy honest.
    """
    src = str(tmp_path / "in.jpg")
    out = str(tmp_path / "out.jpg")
    _make_image(src)
    _write_camera_tags(src)
    _write_ai_xmp(src)

    cleaner.strip_ai(src, out)

    # -n prints GPS numerically (51.5). Without it ExifTool renders DMS
    # ("51 deg 30' 0.00" N"), which is the same value in another format and
    # made this assertion fail while the data was in fact preserved.
    r = _et("-n", "-Make", "-GPSLatitude", "-s", out)
    assert "TestCam" in r.stdout, r.stdout
    assert "51.5" in r.stdout, r.stdout

    # And the AI label applied above is gone.
    r = _et("-XMP-iptcExt:all", "-s", out)
    assert r.stdout.strip() == "", r.stdout


@pytest.mark.skipif(not HAS_EXIFTOOL, reason="exiftool not installed")
def test_strip_does_not_touch_the_picture(tmp_path):
    """Metadata only: the encoded image data must be byte-identical."""
    try:
        from PIL import Image
    except ImportError:
        pytest.skip("Pillow not installed in this environment")

    src = str(tmp_path / "in.png")
    out = str(tmp_path / "out.png")
    _make_image(src, "png")
    _write_ai_xmp(src)

    def image_bytes(path):
        # Decode both and compare pixels, so container-level rewrites that
        # legitimately change offsets do not fail the test.
        return list(Image.open(path).convert("RGB").getdata())

    cleaner.strip_ai(src, out)
    assert image_bytes(src) == image_bytes(out)


@pytest.mark.skipif(not HAS_EXIFTOOL, reason="exiftool not installed")
def test_inspect_reports_signals_but_not_values(tmp_path):
    """A prompt is user data; only counts may leave the server."""
    src = str(tmp_path / "in.jpg")
    _make_image(src)
    _write_ai_xmp(src)

    info = cleaner.inspect(src)
    assert info["available"] is True
    assert info["tags"] > 0
    assert any("AI source label" in s for s in info["signals"])
    # Nothing in the report may contain the value we wrote.
    assert "trainedAlgorithmicMedia" not in str(info)


@pytest.mark.skipif(not HAS_EXIFTOOL, reason="exiftool not installed")
def test_strip_on_clean_file_is_a_safe_noop(tmp_path):
    """A file with nothing to remove must still come back, not error."""
    src = str(tmp_path / "in.jpg")
    out = str(tmp_path / "out.jpg")
    _make_image(src)

    result = cleaner.strip_ai(src, out)
    assert result["had_ai"] is False
    assert result["removed"] == 0
    assert os.path.getsize(out) > 0


@pytest.mark.skipif(not HAS_EXIFTOOL, reason="exiftool not installed")
def test_api_clean_streams_file_with_counts(client, tmp_path):
    """End to end: upload -> strip -> download, with the counts in headers."""
    src = str(tmp_path / "in.jpg")
    _make_image(src)
    _write_ai_xmp(src)

    with open(src, "rb") as f:
        r = client.post(
            "/api/clean",
            files={"file": ("photo.jpg", f.read(), "image/jpeg")},
            headers=_hdr(),
        )

    assert r.status_code == 200, r.text
    assert int(r.headers["X-Clean-Removed"]) > 0
    assert r.headers["X-Clean-Had-AI"] == "1"
    assert "AI source label" in r.headers["X-Clean-Signals"]
    assert "photo-clean.jpg" in r.headers["Content-Disposition"]
    assert r.headers["Content-Type"].startswith("image/jpeg")
    assert len(r.content) > 0


# ---------------------------------------------------------- MP3 (needs mutagen)

@pytest.mark.skipif(
    not HAS_EXIFTOOL, reason="exiftool not installed (needed for inspection)"
)
def test_mp3_strips_geob_and_keeps_user_tags(tmp_path):
    """MP3 goes through mutagen, not FFmpeg.

    The whole reason mutagen is a dependency: FFmpeg clears the C2PA GEOB
    frame but also destroys Title/Artist/Album, which would break AI-only
    mode's promise to touch nothing but the AI layer. This test is what keeps
    that promise honest.
    """
    mutagen = pytest.importorskip("mutagen.id3", reason="mutagen not installed")

    src = str(tmp_path / "in.mp3")
    out = str(tmp_path / "out.mp3")

    if not HAS_FFMPEG:
        pytest.skip("ffmpeg not installed in this environment")
    r = subprocess.run(
        ["ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-y", src],
        capture_output=True, text=True,
    )
    assert r.returncode == 0, r.stderr[-400:]

    # Build a fixture: a C2PA-shaped GEOB frame plus ordinary user tags.
    tags = mutagen.ID3(src)
    tags.add(mutagen.GEOB(
        mime="application/c2pa", desc="c2pa manifest store", data=b"\x00" * 64
    ))
    tags.add(mutagen.TIT2(encoding=3, text="My Title"))
    tags.add(mutagen.TPE1(encoding=3, text="My Artist"))
    tags.save(v2_version=3)

    assert cleaner._id3_has_c2pa(src), "fixture should carry a C2PA GEOB frame"

    result = cleaner.strip_ai(src, out)

    # The C2PA frame is gone (this is also the post-condition strip_ai
    # asserts internally, so a failure here means it would have raised).
    assert cleaner._id3_has_c2pa(out) is False
    assert result["had_ai"] is True
    assert result["removed"] >= 1
    assert result["signals"] == ["Content Credentials (C2PA)"]

    # ...and the tags FFmpeg would have destroyed are still there.
    after = mutagen.ID3(out)
    assert str(after.get("TIT2")) == "My Title"
    assert str(after.get("TPE1")) == "My Artist"


@pytest.mark.skipif(
    not HAS_FFMPEG, reason="ffmpeg not installed in this environment"
)
def test_mp3_path_outputs_a_valid_audio_file(tmp_path):
    """A plain MP3 with nothing to remove must come back intact."""
    pytest.importorskip("mutagen.id3", reason="mutagen not installed")

    src = str(tmp_path / "in.mp3")
    out = str(tmp_path / "out.mp3")
    r = subprocess.run(
        ["ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-y", src],
        capture_output=True, text=True,
    )
    assert r.returncode == 0, r.stderr[-400:]

    result = cleaner.strip_ai(src, out)
    assert os.path.getsize(out) > 0
    assert result["had_ai"] is False
    assert result["removed"] == 0

    # Output must still decode.
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", out],
        capture_output=True, text=True,
    )
    assert probe.returncode == 0, probe.stderr
    assert float(probe.stdout.strip()) > 0.5
