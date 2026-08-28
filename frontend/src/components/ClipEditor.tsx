"use client";

import { useRef, useState } from "react";
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
};

type Clip = {
  id: string;
  start: number;
  end: number;
  audioOnly: boolean;
  filename: string;
};

type State =
  | { kind: "idle" }
  | { kind: "loading"; slow: boolean }
  | { kind: "ready"; source: Source }
  | { kind: "error"; message: string };

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

  const key = process.env.NEXT_PUBLIC_API_KEY || "";
  const authHeader: Record<string, string> = key ? { "X-Tickless-Key": key } : {};

  // ── source load ──────────────────────────────────────────────────────────
  async function loadFromUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setState({ kind: "loading", slow: false });
    const slowTimer = setTimeout(
      () => setState((s) => (s.kind === "loading" ? { kind: "loading", slow: true } : s)),
      3000,
    );
    try {
      const res = await fetch(`${API_URL}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setState({ kind: "error", message: b.detail || "Could not read that link." });
        return;
      }
      
      const data = await res.json();
      // Fetch the clean video to a temp blob we can preview locally.
      const dl = `${API_URL}/api/download?url=${encodeURIComponent(
        url.trim(),
      )}&kind=video${key ? `&key=${encodeURIComponent(key)}` : ""}`;
      const vidRes = await fetch(dl);
      const blob = await vidRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const s: Source = {
        kind: "url",
        url: url.trim(),
        duration: data.duration ?? null,
        title: data.title || "video",
        objectUrl,
      };
      setSource(s);
      setState({ kind: "ready", source: s });
    } catch {
      setState({ kind: "error", message: "Something went wrong. Try again in a moment." });
    } finally {
      clearTimeout(slowTimer);
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
    const clip: Clip = {
      id: crypto.randomUUID(),
      start,
      end,
      audioOnly,
      filename: `${base}_clip_${clips.length + 1}.${ext}`,
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
    if (source.kind === "upload") params.set("token", source.token || "");
    else params.set("source_url", source.url || "");
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
          <p className="mt-3 px-1 text-xs tx-muted">
            URL mode works with TikTok / Instagram / YouTube. Or upload a video from your device (max 500 MB).
          </p>
        </div>
      )}

      {source && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Editor card */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{source.title}</p>
              <button
                onClick={() => {
                  if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
                  setSource(null);
                  setClips([]);
                  setState({ kind: "idle" });
                  setStart(0);
                  setEnd(0);
                }}
                className="text-xs tx-muted hover:tx"
              >
                Change source
              </button>
            </div>

            {/* The player is height-capped so a tall portrait video never blows
                past the viewport on desktop. object-contain keeps the WHOLE clip
                visible (black letterbox), and the trim controls stay on-screen
                right below it. Mobile keeps the natural full-width behavior. */}
            <div className="mt-4 overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                src={source.objectUrl}
                onLoadedMetadata={onLoadedMetadata}
                controls
                className="mx-auto block max-h-[70vh] w-full object-contain"
              />
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
