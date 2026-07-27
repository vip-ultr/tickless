"use client";

import { useRef, useState } from "react";
import { Download, ClipboardPaste, Loader2, Music, Video } from "lucide-react";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/config";
import { AdSlot } from "./AdSlot";

type Result = {
  title: string;
  author: string;
  duration: number | null;
  thumbnail: string | null;
  video_url: string;
  audio_url: string | null;
  height: number | null;
};

type State =
  | { kind: "idle" }
  | { kind: "loading"; slow: boolean }
  | { kind: "done"; data: Result }
  | { kind: "error"; message: string };

export function Downloader() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      /* clipboard blocked; user can type */
    }
  }

  async function extract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setState({ kind: "loading", slow: false });
    // If the free backend is cold, warn after 3s.
    slowTimer.current = setTimeout(
      () => setState((s) => (s.kind === "loading" ? { kind: "loading", slow: true } : s)),
      3000,
    );
    try {
      const res = await fetch(`${API_URL}/api/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.NEXT_PUBLIC_API_KEY
            ? { "X-Tickless-Key": process.env.NEXT_PUBLIC_API_KEY }
            : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: body.detail || "Something went wrong on our side. Give it another try in a moment." });
        return;
      }
      setState({ kind: "done", data: body });
    } catch {
      setState({ kind: "error", message: "Something went wrong on our side. Give it another try in a moment." });
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    }
  }

  function reset() {
    setUrl("");
    setState({ kind: "idle" });
  }

  return (
    <div className="w-full">
      {/* Input */}
      <form onSubmit={extract} className="glass rounded-2xl p-2 md:flex md:items-center md:gap-2">
        <div className="flex flex-1 items-center gap-2 px-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="TikTok video link"
            placeholder="Paste your TikTok link here"
            style={{ color: "var(--text-primary)", caretColor: "var(--brand-accent)" }}
            className="w-full bg-transparent py-3 font-mono text-sm outline-none placeholder:tx-muted"
          />
          <button
            type="button"
            onClick={paste}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs tx-muted hover:tx"
          >
            <ClipboardPaste size={15} /> Paste
          </button>
        </div>
        <button
          type="submit"
          disabled={state.kind === "loading"}
          className="btn-brand mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold disabled:opacity-70 md:mt-0 md:w-auto"
        >
          {state.kind === "loading" ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          Download
        </button>
      </form>
      <p className="mt-3 px-2 text-xs tx-muted">
        Works with tiktok.com, vm.tiktok.com and short links.
      </p>

      {/* States */}
      <div className="mt-6">
        {state.kind === "loading" && <Skeleton slow={state.slow} />}
        {state.kind === "error" && (
          <div className="glass rounded-2xl border-l-2 border-[var(--danger)] p-5 text-sm tx">
            {state.message}
          </div>
        )}
        {state.kind === "done" && (
          <>
            <ResultCard data={state.data} sourceUrl={url.trim()} onReset={reset} />
            <AdSlot slot="result" className="mt-5" />
          </>
        )}
      </div>
    </div>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="mb-4 text-sm tx-muted">
        {slow
          ? "Waking up the server, this takes a few seconds on the first request."
          : "Reading the video..."}
      </p>
      <div className="flex gap-4">
        <div className="h-28 w-20 shrink-0 animate-pulse rounded-xl bg-[var(--glass-border)]" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--glass-border)]" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--glass-border)]" />
          <div className="mt-4 h-9 w-32 animate-pulse rounded-lg bg-[var(--glass-border)]" />
        </div>
      </div>
    </div>
  );
}

function ResultCard({ data, sourceUrl, onReset }: { data: Result; sourceUrl: string; onReset: () => void }) {
  // Stream through the backend: TikTok CDN URLs are IP-locked to the
  // server that extracted them, so direct links get Access Denied.
  const key = process.env.NEXT_PUBLIC_API_KEY || "";
  const dl = (kind: "video" | "audio") =>
    `${API_URL}/api/download?url=${encodeURIComponent(sourceUrl)}&kind=${kind}${key ? `&key=${encodeURIComponent(key)}` : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex gap-4">
        {data.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.thumbnail}
            alt={data.title}
            className="h-28 w-20 shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{data.title}</p>
          <p className="mt-1 text-xs tx-muted">
            @{data.author}
            {data.duration ? ` · ${data.duration}s` : ""}
            {data.height ? ` · ${data.height}p` : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={dl("video")}
          className="btn-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <Video size={16} /> Download
        </a>
        <a
          href={dl("audio")}
          className="glass flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <Music size={16} /> Audio (MP3)
        </a>
        <button
          onClick={onReset}
          className="rounded-xl px-4 py-2.5 text-sm tx-muted hover:tx"
        >
          Download another
        </button>
      </div>
    </motion.div>
  );
}
