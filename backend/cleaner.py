"""AI metadata stripping for the Tickless Clean tool.

Removes AI *provenance metadata* from a file while leaving the encoded
picture and sound alone:

  - C2PA / JUMBF "Content Credentials" (the signed block naming the tool)
  - the IPTC DigitalSourceType field platforms read to show a "made with AI"
    label (XMP-iptcExt)
  - AI prompt fields (AIPromptInformation / AIPromptWriterName)
  - PNG text chunks, including the Stable Diffusion "parameters" recipe
  - recorded edit history, which names AI editors such as Adobe Firefly

It does NOT touch pixels or audio samples. ExifTool rewrites the metadata
containers only; the media data is copied, so there is no quality loss.

HONEST LIMITS (documented in docs/content.md and repeated in the UI): this
removes tags, not watermarks. Google SynthID and marks like it are built into
the pixels and are unreachable by any metadata tool. A clean result is not
proof that a file is not AI-made.

Why ExifTool: it is the one tool that understands the JUMBF container across
JPEG, PNG, WebP, HEIC, AVIF, MP4 and MOV from a single command line. The
Dockerfile installs libimage-exiftool-perl.

Two traps this module was written around, both found by testing the actual
binary rather than trusting documentation:

  1. ExifTool silently DOWNGRADES an unknown tag name to a warning as long as
     at least one other flag in the same invocation is valid, and still exits
     0. So `exiftool -JUMBF:all= -C2PA:all= -XMP:prompt=` reports success
     while only the first flag did anything. Every flag used here was
     verified against `exiftool -listx` and against real C2PA files; the
     names that do not exist (C2PA:all, CBOR:all, PNG-text:*, XMP:prompt,
     XMP:steps, XMP:sampler, XMP:lora, XMP:controlnet, XMP:vae, and
     XMP-dc:DigitalSourceType) are deliberately absent.
  2. ExifTool exits 0 on GIF without removing anything. A zero exit code is
     therefore not proof of removal, so strip_ai() re-reads the file and
     asserts the JUMBF block is actually gone.

MP3 is handled separately: ExifTool cannot write MP3 at all ("Writing of MP3
files is not yet supported"), and C2PA in MP3 lives in an ID3 GEOB frame rather
than JUMBF, so the JUMBF post-condition cannot cover it. ExifTool can still read
that frame, which is what _id3_has_c2pa() uses; the write goes through mutagen,
because FFmpeg also clears the frame but takes Title/Artist/Album with it.
See _strip_id3().
"""
from __future__ import annotations

import os
import shutil
import subprocess

# Extensions we accept, mapped to the media type the download response sends.
SUPPORTED_EXTS: dict[str, str] = {
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "m4v": "video/mp4",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "heif": "image/heif",
    "avif": "image/avif",
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
}

# File types that are written by the ID3 path instead of ExifTool.
_ID3_EXTS = {"mp3"}

# Hard cap so one upload cannot fill the free-tier disk.
MAX_CLEAN_BYTES = 200 * 1024 * 1024

# ExifTool flags for AI-only mode. Verified valid on both the Debian bookworm
# package (12.76) and current git (13.59).
#
# -JUMBF:all=        the C2PA/Content Credentials container itself
# -PNG:all=          PNG text chunks, incl. the SD "parameters" recipe
# -XMP-iptcExt:all=  DigitalSourceType, AIPromptInformation, AIPromptWriterName.
#                    DigitalSourceType lives in the iptcExt family, NOT in
#                    XMP-dc, which is why -XMP-dc:DigitalSourceType= fails.
# -XMP-xmpMM:History / -XMP-photoshop:History
#                    edit records that name the tool that ran, e.g. Firefly
AI_STRIP_FLAGS: list[str] = [
    "-JUMBF:all=",
    "-PNG:all=",
    "-XMP-iptcExt:all=",
    "-XMP-xmpMM:History=",
    "-XMP-photoshop:History=",
]

# Read pass for counting what a file carries. -G1 prefixes each line with its
# group, -s drops the description noise. Every name here was verified to
# resolve on both the Debian package (12.76) and git (13.59).
_INSPECT_FLAGS: list[str] = [
    "-jumbf:all",
    "-XMP-iptcExt:all",
    "-PNG:all",
    "-XMP-xmpMM:History",
    "-XMP-photoshop:History",
    "-G1",
    "-a",
    "-s",
]

# Tag-name fragments that mark a file as AI-labelled. Matched against the TAG
# NAME only, never the value: a prompt is user data and has no business in a
# log line or a report.
_AI_TAG_MARKERS = ("digitalsourcetype", "aiprompt")

# Short human-readable names for the signals we report back to the UI.
_SIGNAL_C2PA = "Content Credentials (C2PA)"
_SIGNAL_LABEL = "AI source label / prompt fields"
_SIGNAL_RECIPE = "Generation recipe"
_SIGNAL_HISTORY = "Edit history"


class CleanError(Exception):
    """A cleaning failure with a code the API maps to user-facing copy."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def exiftool_path() -> str | None:
    return shutil.which("exiftool")


def is_supported(filename: str) -> bool:
    ext = extension_of(filename)
    return ext in SUPPORTED_EXTS


def extension_of(filename: str) -> str:
    name = os.path.basename(filename or "")
    if "." not in name:
        return ""
    return name.rsplit(".", 1)[-1].lower()


def _run(args: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    # Argument list, never a shell string: filenames come from the upload.
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def inspect(path: str) -> dict:
    """Read the AI metadata a file carries.

    Reports tag NAMES and line counts, never what a tag says: a prompt is user
    data and has no business in a log line or an API response.

    `had_ai` is deliberately narrower than `tags > 0`. Plenty of ordinary
    photos carry XMP-iptcExt or edit-history entries that have nothing to do
    with generation, and calling those "AI metadata" would make the tool claim
    to have found something on every file it sees.
    """
    et = exiftool_path()
    if et is None:
        return {"signals": [], "tags": 0, "had_ai": False, "available": False}

    proc = _run([et, *_INSPECT_FLAGS, path])
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]

    # With -G1 -s each line is "[Group] TagName : value".
    found: list[tuple[str, str]] = []
    per_group: dict[str, int] = {}
    for line in lines:
        if line.startswith("[") and "] " in line:
            group, rest = line[1:].split("] ", 1)
            name = rest.split(" : ", 1)[0]
        else:
            group, name = "other", line
        found.append((group, name))
        per_group[group] = per_group.get(group, 0) + 1

    has_c2pa = per_group.get("JUMBF", 0) > 0
    has_label = any(
        any(marker in name.lower() for marker in _AI_TAG_MARKERS)
        for _, name in found
    )
    has_recipe = any(
        group == "PNG" and "parameters" in name.lower() for group, name in found
    )
    has_history = any(
        group in ("XMP-xmpMM", "XMP-photoshop") and name.lower() == "history"
        for group, name in found
    )

    signals = []
    if has_c2pa:
        signals.append(_SIGNAL_C2PA)
    if has_label:
        signals.append(_SIGNAL_LABEL)
    if has_recipe:
        signals.append(_SIGNAL_RECIPE)
    if has_history:
        signals.append(_SIGNAL_HISTORY)

    return {
        "signals": signals,
        "tags": len(lines),
        "had_ai": has_c2pa or has_label or has_recipe,
        "groups": per_group,
        "available": True,
    }


def _jumbf_count(path: str) -> int:
    """Number of JUMBF/C2PA tag lines still present. Post-condition check."""
    et = exiftool_path()
    if et is None:
        return 0
    proc = _run([et, "-jumbf:all", "-G1", "-a", "-s", path])
    return len([ln for ln in proc.stdout.splitlines() if ln.strip()])


def _id3_has_c2pa(path: str) -> bool:
    """Is a C2PA manifest sitting in this file's ID3 GEOB frame?

    C2PA in MP3 is stored as an ID3v2 GEOB frame (MIME application/c2pa), not
    as JUMBF, which is why _jumbf_count cannot see it. ExifTool reads MP3 fine
    (it is the WRITING it refuses), so inspection still goes through it.

    Matched on the GEOB line rather than a bare "c2pa" substring, so a track
    whose Title happens to contain the letters is not reported as provenance.
    """
    et = exiftool_path()
    if et is None:
        return False
    proc = _run([et, "-ID3:all", "-G1", "-a", "-s", path])
    for line in proc.stdout.splitlines():
        low = line.lower()
        if "application/c2pa" in low or ("geob" in low and "c2pa" in low):
            return True
    return False


def _strip_id3(src: str, out: str) -> int:
    """Delete the C2PA GEOB frame from an MP3. Returns frames removed.

    FFmpeg also clears the frame, but it takes every other ID3 tag with it
    (Title, Artist, Album all vanish), which contradicts this feature's core
    promise that only the AI layer is touched. Mutagen deletes the one frame
    and rewrites nothing else.

    ExifTool cannot be used for the write at all: "Writing of MP3 files is
    not yet supported".

    mutagen's GEOB attributes are lowercase (mime, desc); the capitalized
    names some examples use do not exist and cause a silent no-op, where the
    loop finds nothing to delete and reports success on an uncleaned file.
    """
    try:
        from mutagen.id3 import ID3, ID3NoHeaderError
    except ImportError as e:
        raise CleanError("clean_failed") from e

    shutil.copyfile(src, out)

    try:
        tags = ID3(out)
    except ID3NoHeaderError:
        # No ID3 header at all, so there is nothing to remove and the copy
        # is already clean.
        return 0
    except Exception as e:
        raise CleanError("clean_failed") from e

    removed = 0
    for key in list(tags.keys()):
        frame = tags[key]
        if getattr(frame, "FrameID", "") != "GEOB":
            continue
        mime = str(getattr(frame, "mime", "") or getattr(frame, "MimeType", "") or "")
        desc = str(getattr(frame, "desc", "") or getattr(frame, "Desc", "") or "")
        if "c2pa" in f"{mime} {desc}".lower():
            del tags[key]
            removed += 1

    if removed:
        # Keep the tag version the file already used rather than upgrading it.
        version = getattr(tags, "version", (2, 4))
        tags.save(v2_version=version[1] if version[1] in (3, 4) else 4)
    return removed


def strip_ai(src: str, out: str) -> dict:
    """Strip AI metadata from src into out.

    src and out must be different paths. Returns {"removed": int,
    "signals": [...], "had_ai": bool}. Raises CleanError.
    """
    if not os.path.isfile(src):
        raise CleanError("clean_failed")

    ext = extension_of(src)
    if ext not in SUPPORTED_EXTS:
        raise CleanError("unsupported")

    # ID3 takes its own route (ExifTool cannot write MP3), so branch before
    # paying for the general-purpose inspection pass.
    if ext in _ID3_EXTS:
        removed = _strip_id3(src, out)
        # Same post-condition discipline as the ExifTool path: a zero exit
        # code is not proof. If the frame survived, fail loudly rather than
        # hand back a file the page has just promised is clean.
        if _id3_has_c2pa(out):
            raise CleanError("clean_failed")
        return {
            "removed": removed,
            "tags": removed,
            "signals": [_SIGNAL_C2PA] if removed else [],
            "had_ai": removed > 0,
        }

    before = inspect(src)

    et = exiftool_path()
    if et is None:
        raise CleanError("clean_failed")

    # Work on a copy so the upload is never modified in place before we know
    # the write succeeded, then strip it in place (no *_original litter).
    shutil.copyfile(src, out)
    proc = _run([et, *AI_STRIP_FLAGS, "-overwrite_original", out])

    if proc.returncode != 0:
        raise CleanError("clean_failed")

    # Exit 0 is not proof of removal: ExifTool silently accepts some flags
    # and does nothing on other formats. Assert the container is really gone.
    if _jumbf_count(out) > 0:
        raise CleanError("clean_failed")

    after = inspect(out)
    removed = max(0, before["tags"] - after["tags"])

    return {
        "removed": removed,
        "tags": removed,
        "signals": before["signals"],
        # NOT `before["tags"] > 0`: ordinary photos routinely carry XMP-iptcExt
        # and edit-history entries with nothing to do with generation, and
        # counting those as AI metadata would make the tool claim to have
        # found something on every file it sees. inspect() already does the
        # narrow matching; this just passes it through.
        "had_ai": before["had_ai"],
    }
