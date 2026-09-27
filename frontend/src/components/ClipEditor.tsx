"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Link2,
  Upload,
  Loader2,
  Play,
  Pause,
  Plus,
  Download,
  Trash2,
  Music,
  FileVideo,
} from "lucide-react";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/config";

// ─── types ──────────────────────────────────────────────────────────────────

type Source = {
  kind: "url" | "upload";
  token?: string; // upload flow
  url?: string; // url flow
  duration: number | null;
  title: string;
  objectUrl?: string; // local upload preview
  // Carousel support. Both are set only for a genuinely multi-slide post, so a
  // single video and an upload keep behaving exactly as they did before.
  gallery?: string[]; // every slide, in the post's own order
  galleryTypes?: string[]; // parallel to gallery: "video" | "photo"
  slideIndex?: number; // loaded slide, as an index into gallery (not into videos)
};

type Clip = {
  id: string;
  start: number;
  end: number;
  audioOnly: boolean;
  filename: string;
  // Which slide this clip was cut from, captured when Add clip was pressed.
  // Kept per clip (not read off `source` at render time) so clips queued from
  // several videos keep pointing at their own video after the player moves on.
  slideIndex?: number;
};

type State =
  | { kind: "idle" }
  | { kind: "loading"; slow: boolean }
  | { kind: "ready"; source: Source }
  | { kind: "error"; message: string }
  // A carousel with no video in it. Not an error, so it gets its own state and
  // its own copy instead of the red danger panel.
  | { kind: "photos"; count: number };

/** An error whose message is already written for the user to read. Anything
 *  else (a network TypeError, say) falls back to generic copy. */
function userError(message: string): Error {
  const e = new Error(message);
  e.name = "UserError";
  return e;
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export function ClipEditor() {
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [source, setSource] = useState<Source | null>(null);

  // trim handles
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [audioOnly, setAudioOnly] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // clip list
  const [clips, setClips] = useState<Clip[]>([]);
  const [segPlaying, setSegPlaying] = useState(false);

  // Carousel selection. `pendingIndex` is the slide the user just clicked and
  // we are still fetching; it goes null once the new source lands (or fails).
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  const key = process.env.NEXT_PUBLIC_API_KEY || "";
  const authHeader: Record<string, string> = key ? { "X-Tickless-Key": key } : {};

  // Which slides can actually be trimmed. Photos are dropped: there is no
  // stream to cut, and a mixed Instagram carousel is mostly photos. The index
  // stays the post's own (0-based into gallery) because that is what the
  // backend indexes with - the video-only list is a display concern only.
  const slides = source?.gallery ?? [];
  const galleryTypes = source?.galleryTypes ?? [];
  const hasSlides = slides.length > 1;
  const videoSlides = hasSlides
    ? slides
        .map((_, index) => ({ index, photo: galleryTypes[index] === "photo" }))
        .filter((s) => !s.photo)
    : [];
  const photoCount = hasSlides ? slides.length - videoSlides.length : 0;
  const switching = pendingIndex !== null;

  // ── source load ──────────────────────────────────────────────────────────
  /** Fetch one source into an object URL the <video> can preview.
   *  `slideIndex` selects a carousel item; omitted, the backend serves the
   *  single item (or the post's primary) exactly as it always did. */
  async function fetchPreview(sourceUrl: string, slideIndex?: number): Promise<string> {
    const params = new URLSearchParams({ url: sourceUrl, kind: "video" });
    if (key) params.set("key", key);
    if (slideIndex !== undefined) params.set("gallery_index", String(slideIndex));
    const res = await fetch(`${API_URL}/api/download?${params.toString()}`);
    if (!res.ok) {
      // Without this the error JSON was fed to <video> as if it were media,
      // which shows a dead player instead of a reason.
      const body = await res.json().catch(() => ({}));
      throw userError(body.detail || "Could not read that link.");
    }
    return URL.createObjectURL(await res.blob());
  }

  async function loadFromUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const link = url.trim();
    setState({ kind: "loading", slow: false });
    const slowTimer = setTimeout(
      () => setState((s) => (s.kind === "loading" ? { kind: "loading", slow: true } : s)),
      3000,
    );
    try {
      const res = await fetch(`${API_URL}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ url: link }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setState({ kind: "error", message: b.detail || "Could not read that link." });
        return;
      }

      const data = await res.json();
      const postSlides: string[] = data.gallery ?? [];
      const postTypes: string[] = data.gallery_types ?? [];
      const isCarousel = postSlides.length > 1;
      const videos = isCarousel
        ? postTypes.map((t, index) => ({ index, photo: t === "photo" })).filter((v) => !v.photo)
        : [];

      if (isCarousel && videos.length === 0) {
        setState({ kind: "photos", count: postSlides.length });
        return;
      }

      // Open on the first video, never on slide 1: a carousel's first slide is
      // very often a photo, which is what used to land a JPEG in the player.
      const slideIndex = isCarousel ? videos[0].index : undefined;
      const objectUrl = await fetchPreview(link, slideIndex);

      const s: Source = {
        kind: "url",
        url: link,
        duration: data.duration ?? null,
        title: data.title || "video",
        objectUrl,
        gallery: isCarousel ? postSlides : undefined,
        galleryTypes: isCarousel ? postTypes : undefined,
        slideIndex,
      };
      setSource(s);
      setState({ kind: "ready", source: s });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error && err.name === "UserError"
            ? err.message
            : "Something went wrong. Try again in a moment.",
      });
    } finally {
      clearTimeout(slowTimer);
    }
  }

  /** Swap the player onto another slide of the same post. */
  async function selectSlide(index: number) {
    if (!source?.url || source.slideIndex === index || pendingIndex !== null) return;
    setPendingIndex(index);
    setItemError(null);
    try {
      const objectUrl = await fetchPreview(source.url, index);
      // Drop the outgoing clip's listeners before the element changes media,
      // or a stale timeupdate handler keeps firing against the new source.
      segStop.current?.();
      setSegPlaying(false);
      if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
      // The trim range belonged to the previous slide; carrying it over could
      // leave the end handle past the new video's duration.
      setStart(0);
      setEnd(0);
      setSource({ ...source, objectUrl, slideIndex: index, duration: null });
    } catch (err) {
      setItemError(
        err instanceof Error && err.name === "UserError"
          ? err.message
          : "Could not load that video. Try another one.",
      );
    } finally {
      setPendingIndex(null);
    }
  }

  async function loadFromUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ kind: "loading", slow: false });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/clip/upload`, {
        method: "POST",
        headers: { ...authHeader },
        body: form,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setState({ kind: "error", message: b.detail || "Upload failed." });
        return;
      }
      const data = await res.json();
      const objectUrl = URL.createObjectURL(file);
      const s: Source = {
        kind: "upload",
        token: data.token,
        duration: data.duration ?? null,
        title: file.name || "uploaded video",
        objectUrl,
      };
      setSource(s);
      setState({ kind: "ready", source: s });
    } catch {
      setState({ kind: "error", message: "Upload failed. Try again." });
    } finally {
      // Only reset loading -> idle if we never reached ready (e.g. network error
      // before setState above ran). On success the try already set ready.
      setState((s) => (s.kind === "loading" ? { kind: "idle" } : s));
    }
  }

  function onLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || source?.duration || 0;
    setEnd(d);
    setSource((s) => (s ? { ...s, duration: d } : s));
  }

  // ── trim ──────────────────────────────────────────────────────────────────
  // Playback state for the selection preview:
  //   segPlaying = actively playing, segPaused = paused mid-selection.
  // We keep the timeupdate/ended listeners alive while paused so "Play selection"
  // resumes from the paused position instead of restarting.
  const segStop = useRef<(() => void) | null>(null);
  const segPaused = useRef(false);

  function playSelection(fresh: boolean) {
    const v = videoRef.current;
    if (!v) return;
    const stop = () => {
      setSegPlaying(false);
      segPaused.current = false;
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", stop);
      segStop.current = null;
    };
    const onTime = () => {
      if (v.currentTime >= end) {
        v.pause();
        stop();
      }
    };
    // Fresh play (first play, or after the selection changed) starts at `start`.
    // A resumed play (toggling back from pause) continues from the current time.
    if (fresh || v.currentTime < start || v.currentTime >= end) v.currentTime = start;
    v.play().catch(() => {});
    setSegPlaying(true);
    segPaused.current = false;
    if (!segStop.current) {
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("ended", stop);
      segStop.current = stop;
    }
  }

  // Pause mid-selection: hold the playhead so Play can resume from here.
  function pauseSelection() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setSegPlaying(false);
    segPaused.current = true;
  }

  // Toggle: playing -> pause (hold position); paused -> resume; idle -> fresh play.
  function togglePlay() {
    if (segPlaying) pauseSelection();
    else if (segPaused.current) playSelection(false);
    else playSelection(true);
  }

  // Moving a trim handle while playing/paused stops playback entirely and snaps to
  // the new selection start, so the button returns to "Play selection" and the next
  // Play is a fresh preview (editor convention: scrubbing halts playback).
  function pauseForAdjust(newStart: number) {
    const v = videoRef.current;
    if (segPlaying || segPaused.current) segStop.current?.();
    // Actually halt the <video> element — clearing state alone leaves it running.
    if (v) {
      v.pause();
      v.currentTime = newStart;
    }
  }

  function addClip() {
    if (!source) return;
    if (end <= start) return;
    const base = (source.title || "tickless-clip").replace(/\.[^.]+$/, "");
    const ext = audioOnly ? "mp3" : "mp4";
    const slide = source.slideIndex;
    const clip: Clip = {
      id: crypto.randomUUID(),
      start,
      end,
      audioOnly,
      // Name the slide on a carousel so clips queued from two different videos
      // never come out identical. Single videos and uploads are untouched.
      filename: `${base}${slide !== undefined ? `_v${slide + 1}` : ""}_clip_${clips.length + 1}.${ext}`,
      slideIndex: slide,
    };
    setClips((c) => [...c, clip]);
  }

  function removeClip(id: string) {
    setClips((c) => c.filter((x) => x.id !== id));
  }

  // ── download (lazy, via native anchor so the browser actually saves) ──────
  // The earlier fetch->blob->click approach silently failed: after `await`, the
  // programmatic click is no longer in a user-gesture context, so the browser
  // suppresses the download. A native <a href> (like the home Downloader) works.
  function clipHref(clip: Clip): string {
    if (!source) return "#";
    const params = new URLSearchParams({
      start: String(clip.start),
      end: String(clip.end),
      audio_only: String(clip.audioOnly),
    });
    if (source.kind === "upload") {
      params.set("token", source.token || "");
    } else {
      params.set("source_url", source.url || "");
      // Read off the CLIP, not the source: by the time the user downloads,
      // the player may have moved on to another slide, and every queued clip
      // must still trim the video it was marked on.
      if (clip.slideIndex !== undefined) params.set("gallery_index", String(clip.slideIndex));
    }
    if (key) params.set("key", key);
    return `${API_URL}/api/clip?${params.toString()}`;
  }

  function downloadAll() {
    if (!source) return;
    // Click each clip's native download anchor in sequence.
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("[data-clip-dl]"),
    );
    anchors.forEach((a, i) => {
      setTimeout(() => a.click(), i * 400);
    });
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const max = source?.duration || 0;

  return (
    <div className="w-full">
      {!source && (
        <div className="glass rounded-2xl p-5">
          {/* tab switch */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setTab("url")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === "url" ? "btn-brand" : "glass tx-muted"
              }`}
            >
              <Link2 size={16} /> Paste link
            </button>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === "upload" ? "btn-brand" : "glass tx-muted"
              }`}
            >
              <Upload size={16} /> Upload
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  setTab("upload");
                  loadFromUpload(e);
                }}
              />
            </label>
          </div>

          {tab === "url" && (
            <form onSubmit={loadFromUrl} className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-label="TikTok or Instagram link"
                placeholder="Paste your TikTok or Instagram link"
                style={{ color: "var(--text-primary)", caretColor: "var(--brand-primary)" }}
                className="flex-1 min-w-0 rounded-xl bg-transparent px-3 py-3 font-mono text-sm outline-none"
              />
              <button
                type="submit"
                disabled={state.kind === "loading"}
                className="btn-brand flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-6 py-3 font-semibold disabled:opacity-70 md:w-auto"
              >
                {state.kind === "loading" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Scissors size={18} />
                )}
                Load video
              </button>
            </form>
          )}

          {state.kind === "loading" && (
            <p className="mt-4 text-sm tx-muted">
              {state.slow ? "Waking up the server, this takes a few seconds." : "Reading the video..."}
            </p>
          )}
          {state.kind === "error" && (
            <div className="mt-4 rounded-2xl border-l-2 border-[var(--danger)] p-4 text-sm tx">
              {state.message}
            </div>
          )}
          {state.kind === "photos" && (
            <div className="mt-4 rounded-2xl border-l-2 border-[var(--brand-primary)] p-4">
              <p className="text-sm tx">
                This carousel has {state.count} photo{state.count !== 1 ? "s" : ""} and no video,
                so there is nothing here to trim.
              </p>
              <p className="mt-1 text-xs tx-muted">
                Photos are not videos — save them from the{" "}
                <Link href="/" className="underline hover:tx">
                  download page
                </Link>{" "}
                instead.
              </p>
            </div>
          )}
          <p className="mt-3 px-1 text-xs tx-muted">
            URL mode works with TikTok / Instagram / YouTube. Or upload a video from your device (max 500 MB).
          </p>
        </div>
      )}

      {source && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Editor card */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">{source.title}</p>
              <button
                onClick={() => {
                  if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
                  setSource(null);
                  setClips([]);
                  setState({ kind: "idle" });
                  setStart(0);
                  setEnd(0);
                  setPendingIndex(null);
                  setItemError(null);
                }}
                className="shrink-0 text-xs tx-muted hover:tx"
              >
                Change source
              </button>
            </div>

            {/* Carousel picker. Only rendered for a genuinely multi-slide post,
                and only ever lists the videos — a photo has no stream to trim.
                The chips use the post's own slide order via `index`, which is
                what the backend expects, while the label counts videos so the
                first chip reads "Video 1" even when it is slide 3. */}
            {hasSlides && (
              <div className="mt-4">
                <p className="text-xs tx-muted">
                  {videoSlides.length} video{videoSlides.length !== 1 ? "s" : ""} in this carousel
                  {photoCount > 0 &&
                    ` · ${photoCount} photo${photoCount !== 1 ? "s" : ""} skipped, photos can't be trimmed`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {videoSlides.map((s, n) => {
                    const active = source.slideIndex === s.index || pendingIndex === s.index;
                    const isPending = pendingIndex === s.index;
                    return (
                      <button
                        key={s.index}
                        type="button"
                        onClick={() => selectSlide(s.index)}
                        disabled={switching}
                        aria-pressed={active}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                          active
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 tx"
                            : "border-transparent bg-[var(--glass-border)] tx-muted hover:tx"
                        }`}
                      >
                        {isPending ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                        Video {n + 1}
                      </button>
                    );
                  })}
                </div>
                {itemError && <p className="mt-2 text-xs text-[var(--danger)]">{itemError}</p>}
              </div>
            )}

            {/* The player is height-capped so a tall portrait video never blows
                past the viewport on desktop. object-contain keeps the WHOLE clip
                visible (black letterbox), and the trim controls stay on-screen
                right below it. Mobile keeps the natural full-width behavior. */}
            <div className="relative mt-4 overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                src={source.objectUrl}
                onLoadedMetadata={onLoadedMetadata}
                controls
                className="mx-auto block max-h-[70vh] w-full object-contain"
              />
              {/* Swapping slides swaps the media, so keep the frame up while the
                  new one downloads instead of flashing an empty player. */}
              {switching && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 size={28} className="animate-spin text-white" />
                </div>
              )}
            </div>

            {/* trim handles */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs tx-muted">
                <span>Start: {fmt(start)}</span>
                <span>Selected: {fmt(Math.max(0, end - start))}</span>
                <span>End: {fmt(end)}</span>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={0.1}
                  value={start}
                  onChange={(e) => {
                    const val = Math.min(Number(e.target.value), end - 0.1);
                    setStart(val);
                    pauseForAdjust(val);
                  }}
                  className="w-full accent-[var(--brand-primary)]"
                  aria-label="Start time"
                />
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={0.1}
                  value={end}
                  onChange={(e) => {
                    const val = Math.max(Number(e.target.value), start + 0.1);
                    setEnd(val);
                    pauseForAdjust(start);
                  }}
                  className="w-full accent-[var(--brand-primary)]"
                  aria-label="End time"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={togglePlay}
                className="glass flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:tx"
              >
                {segPlaying ? <Pause size={16} /> : <Play size={16} />}
                {segPlaying ? "Pause selection" : "Play selection"}
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-sm tx-muted">
                <input
                  type="checkbox"
                  checked={audioOnly}
                  onChange={(e) => setAudioOnly(e.target.checked)}
                  className="accent-[var(--brand-primary)]"
                />
                <Music size={15} /> Audio only
              </label>
              <button
                onClick={addClip}
                disabled={end <= start}
                className="btn-brand ml-auto flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                <Plus size={16} /> Add clip
              </button>
            </div>
          </div>

          {/* results */}
          {clips.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{clips.length} clip{clips.length !== 1 ? "s" : ""} ready</h3>
                <button
                  onClick={downloadAll}
                  className="btn-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  <Download size={16} /> Download all
                </button>
              </div>
              <div className="space-y-2">
                {clips.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--glass-border)] p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.86_0.19_130_/_0.15)]">
                      {c.audioOnly ? <Music size={15} className="tx-accent" /> : <FileVideo size={15} className="tx-accent" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.filename}</p>
                      <p className="text-xs tx-muted">
                        {fmt(c.start)} → {fmt(c.end)} · {fmt(c.end - c.start)}
                        {c.audioOnly ? " · audio" : " · video"}
                      </p>
                    </div>
                    <input
                      value={c.filename}
                      onChange={(e) =>
                        setClips((cs) => cs.map((x) => (x.id === c.id ? { ...x, filename: e.target.value } : x)))
                      }
                      className="w-40 rounded-lg bg-transparent px-2 py-1 text-xs outline-none tx-muted"
                      aria-label="Clip filename"
                    />
                    <a
                      href={clipHref(c)}
                      download={c.filename}
                      data-clip-dl
                      className="btn-brand flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                    >
                      <Download size={15} /> Download
                    </a>
                    <button
                      onClick={() => removeClip(c.id)}
                      aria-label="Remove clip"
                      className="glass flex h-9 w-9 items-center justify-center rounded-xl tx-muted hover:tx"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
