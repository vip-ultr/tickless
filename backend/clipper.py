"""Manual video clipping for Tickless.

Ported from my-video-clipper's ffmpeg pipeline (option B): one source video,
the user marks several start/end segments, each becomes a clip. No AI, no
subtitles/blur/watermark/aspect (those are explicitly out of scope).

Two operations are exposed:

  - trim_segment(src, start, end, out_path, audio_only): cut a single segment.
  - resolve_source(...): turn a {source_url | token} into a local file path.

ffmpeg is invoked as a subprocess with an argument LIST (never a shell string),
which also fixes the quote-breaking bug present in the clipper's
burnSubtitles(), where a subtitle path with a space/quote broke the filter.

The backend image already installs ffmpeg (Dockerfile), so no extra deps.
Rendered clips are streamed and the temp file deleted (see main.py /api/clip);
nothing is persisted to Supabase.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import time

# Parked-upload directory layout: CLIP_UPLOAD_ROOT/<token>/source.<ext>
CLIP_UPLOAD_ROOT = os.getenv("CLIP_TMP_DIR", "/tmp/tickless-clips")

# Clamp guards so a bad payload cannot spawn a runaway ffmpeg encode.
MAX_SEGMENT_SECONDS = 60 * 60 * 2  # 2h per clip


def ffmpeg_path() -> str | None:
    """ffmpeg binary: prefer system PATH; the image guarantees it."""
    return shutil.which("ffmpeg")


def ffprobe_duration(src: str) -> float | None:
    """Return video duration in seconds via ffprobe, or None if unavailable."""
    ffprobe = shutil.which("ffprobe")
    if ffprobe is None:
        return None
    try:
        out = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                src,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if out.returncode != 0:
            return None
        return float(out.stdout.strip())
    except (ValueError, subprocess.SubprocessError):
        return None


def _clamp_segment(start: float, end: float) -> tuple[float, float]:
    """Validate and clamp a requested segment. Raises ValueError if invalid."""
    if not (isinstance(start, (int, float)) and isinstance(end, (int, float))):
        raise ValueError("start and end must be numbers")
    start = max(0.0, float(start))
    end = max(0.0, float(end))
    if end <= start:
        raise ValueError("end must be greater than start")
    if (end - start) > MAX_SEGMENT_SECONDS:
        raise ValueError(f"segment too long (max {MAX_SEGMENT_SECONDS}s)")
    return start, end


def trim_segment(
    src: str,
    start: float,
    end: float,
    out_path: str,
    audio_only: bool = False,
) -> str:
    """Cut [start, end] from src into out_path.

    Returns out_path on success. Raises RuntimeError on ffmpeg failure.
    audio_only -> output an audio file (mp3) with no video stream.

    Uses -ss before -i for fast seek, -to as an absolute end timestamp. The
    segment is re-encoded (libx264/aac) so any keyframe/codec mismatch in the
    source still produces a clean, widely-playable clip.
    """
    if not os.path.isfile(src):
        raise ValueError("source file not found")

    ffmpeg = ffmpeg_path()
    if ffmpeg is None:
        raise RuntimeError("ffmpeg is not available on this server")

    start, end = _clamp_segment(start, end)
    duration = end - start

    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Argument LIST (no shell) -> safe from path/quote injection.
    if audio_only:
        args = [
            ffmpeg,
            "-ss",
            f"{start:.3f}",
            "-i",
            src,
            "-t",
            f"{duration:.3f}",
            "-vn",                       # no video
            "-acodec",
            "libmp3lame",
            "-b:a",
            "128k",
            "-y",
            out_path,
        ]
    else:
        args = [
            ffmpeg,
            "-ss",
            f"{start:.3f}",
            "-i",
            src,
            "-t",
            f"{duration:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "26",
            "-pix_fmt",
            "yuv420p",     # broad player compatibility
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-movflags",
            "+faststart",
            "-y",
            out_path,
        ]

    proc = subprocess.run(args, capture_output=True, text=True, timeout=600)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed (code {proc.returncode}): "
            f"{proc.stderr[-800:] if proc.stderr else 'no stderr'}"
        )
    if not os.path.isfile(out_path) or os.path.getsize(out_path) == 0:
        raise RuntimeError("ffmpeg produced no output file")
    return out_path


def park_upload(token: str, filename: str) -> str:
    """Create the parked-upload directory for a token; return its path.

    Source files are written here by the upload route and resolved by token.
    """
    if not token or "/" in token or ".." in token:
        raise ValueError("invalid upload token")
    d = os.path.join(CLIP_UPLOAD_ROOT, token)
    os.makedirs(d, exist_ok=True)
    return d


def source_path_for_token(token: str) -> str | None:
    """Resolve a parked source file path from a token, or None."""
    if not token or "/" in token or ".." in token:
        return None
    d = os.path.join(CLIP_UPLOAD_ROOT, token)
    if not os.path.isdir(d):
        return None
    for name in os.listdir(d):
        full = os.path.join(d, name)
        if os.path.isfile(full) and name.startswith("source."):
            return full
    return None


def upload_token_dir(token: str) -> str | None:
    d = os.path.join(CLIP_UPLOAD_ROOT, token)
    return d if os.path.isdir(d) else None


def sweep_expired_uploads(max_age_seconds: int = 60 * 60) -> int:
    """Delete parked-upload dirs older than max_age_seconds.

    Mirrors my-video-clipper's cleanup job (1h TTL). The source is only needed
    while the user is actively clipping; Render's fs is ephemeral anyway, but
    this prevents a forgotten upload from lingering on the free-tier disk.
    Returns the number of dirs removed.
    """
    if not os.path.isdir(CLIP_UPLOAD_ROOT):
        return 0
    removed = 0
    now = time.time()
    for name in os.listdir(CLIP_UPLOAD_ROOT):
        d = os.path.join(CLIP_UPLOAD_ROOT, name)
        if not os.path.isdir(d):
            continue
        try:
            age = now - os.path.getmtime(d)
            if age > max_age_seconds:
                shutil.rmtree(d, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed
