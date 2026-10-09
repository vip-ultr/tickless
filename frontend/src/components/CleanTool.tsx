"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Download, ShieldCheck, RotateCcw, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/config";

type State =
  | { kind: "idle" }
  | { kind: "ready"; file: File }
  | { kind: "working" }
  | { kind: "done"; file: File; url: string; removed: number; hadAI: boolean; signals: string[] }
  | { kind: "error"; message: string };

// Mirrors CLEAN_MESSAGES in backend/main.py so the drop zone can reject a
// wrong file type before we spend a request on it. Backend copy is still the
// source of truth for anything that reaches the server.
const ACCEPT = ".mp4,.mov,.m4v,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.mp3,.m4a";
const MAX_BYTES = 200 * 1024 * 1024;

const UNSUPPORTED = "That file type is not supported. Try an MP4, MOV, JPEG, PNG, WebP, HEIC, AVIF, or MP3.";
const TOO_LARGE = "That file is too large. The limit is 200 MB.";
const GENERIC = "Something went wrong stripping the metadata. Try again, or use a different file.";

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CleanTool() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const key = process.env.NEXT_PUBLIC_API_KEY || "";
  const authHeader: Record<string, string> = key ? { "X-Tickless-Key": key } : {};

  // The cleaned file lives in browser memory only; the server deletes its copy
  // as soon as the response finishes streaming.
  //
  // Revocation happens here and ONLY here. Doing it inside setState's updater
  // would be a side effect React may run twice under StrictMode.
  useEffect(() => {
    if (state.kind !== "done") return;
    return () => URL.revokeObjectURL(state.url);
  }, [state]);

  function pick(file: File | undefined | null) {
    if (!file) return;
    const dot = file.name.lastIndexOf(".");
    const ext = dot > -1 ? file.name.slice(dot + 1).toLowerCase() : "";
    if (!ACCEPT.split(",").some((a) => a.slice(1) === ext)) {
      setState({ kind: "error", message: UNSUPPORTED });
      return;
    }
    if (file.size === 0) {
      setState({ kind: "error", message: "That file is empty." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ kind: "error", message: TOO_LARGE });
      return;
    }
    setState({ kind: "ready", file });
  }

  async function clean(file: File) {
    setState({ kind: "working" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/clean`, {
        method: "POST",
        headers: { ...authHeader },
        body: form,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setState({ kind: "error", message: b.detail || GENERIC });
        return;
      }
      const blob = await res.blob();
      const signals = (res.headers.get("X-Clean-Signals") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setState({
        kind: "done",
        file,
        url: URL.createObjectURL(blob),
        removed: Number(res.headers.get("X-Clean-Removed") || 0),
        hadAI: res.headers.get("X-Clean-Had-AI") === "1",
        signals,
      });
    } catch {
      setState({ kind: "error", message: GENERIC });
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  const busy = state.kind === "working";

  return (
    <div className="w-full">
      {/* Deliberately NOT .glass on this box: .glass declares the `border`
          shorthand, so a dashed utility on the same element would come down to
          a cascade race between two rules of identical specificity. Explicit
          Tailwind utilities only, matching the advertise page's spec box
          (bg-elevated + dashed, --glass-border for the resting outline). */}
      <div
        onClick={(e) => {
          // The whole box opens the picker, not just the label. Clicks on
          // nested controls (Clean this file, the download link, reset)
          // bubble here too, so they are excluded.
          if (state.kind !== "idle" && state.kind !== "ready") return;
          if ((e.target as HTMLElement).closest("button, a")) return;
          inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) pick(e.dataTransfer.files?.[0]);
        }}
        className={`cursor-pointer rounded-2xl border border-dashed p-6 bg-[var(--bg-elevated)] transition-colors ${
          dragging ? "border-[var(--brand-primary)]" : "border-[var(--glass-border)]"
        }`}
      >
        {/* Idle / ready */}
        {(state.kind === "idle" || state.kind === "ready") && (
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[oklch(0.78_0.16_195_/_0.15)]">
              <FileUp size={24} className="tx" />
            </span>

            {/* `tx` is load-bearing here: <button> does not inherit color, so
                without an explicit class this text renders in the UA's
                buttontext colour (black) on a dark surface. It was the one
                invisible element on this page. */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="text-base font-semibold tx hover:tx-accent"
            >
              Drop a file here, or click to choose one
            </button>
            <p className="mt-2 text-sm tx">
              MP4, MOV, JPEG, PNG, WebP, HEIC, AVIF, MP3. Up to 200 MB.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />

            {state.kind === "ready" && (
              <div className="mt-5 flex w-full flex-col items-center gap-3">
                <p className="max-w-full truncate text-sm tx">
                  {state.file.name} · {fmtSize(state.file.size)}
                </p>
                <button
                  onClick={() => clean(state.file)}
                  className="btn-brand flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold"
                >
                  <ShieldCheck size={16} />
                  Clean this file
                </button>
              </div>
            )}
          </div>
        )}

        {/* Working */}
        {state.kind === "working" && (
          <div className="flex flex-col items-center py-4 text-center">
            <Loader2 size={28} className="animate-spin tx-accent" />
            <p className="mt-4 text-sm font-medium tx">Stripping metadata...</p>
          </div>
        )}

        {/* Done */}
        {state.kind === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[oklch(0.86_0.19_130_/_0.15)]">
              <ShieldCheck size={24} className="tx" />
            </span>

            {/* Branch on removed, not hadAI: edit history is stripped too, and
                a file whose only payload was an AI tool's edit record has had
                something removed even though no AI label was attached. */}
            <p className="text-base font-semibold tx">
              {state.removed > 0
                ? `Done. ${state.removed} tag${state.removed === 1 ? "" : "s"} removed. The file is ready.`
                : "Nothing to remove. This file carries no AI metadata."}
            </p>

            {state.signals.length > 0 && (
              <p className="mt-2 text-xs tx">Found: {state.signals.join(", ")}</p>
            )}

            <a
              href={state.url}
              download={`${state.file.name.replace(/\.[^.]+$/, "")}-clean`}
              className="btn-brand mt-5 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold"
            >
              <Download size={16} />
              Download the clean file
            </a>

            <button
              onClick={reset}
              className="mt-3 flex items-center gap-2 text-sm tx hover:tx-accent"
            >
              <RotateCcw size={14} />
              Clean another file
            </button>
          </motion.div>
        )}

        {/* Error */}
        {state.kind === "error" && (
          <div className="flex flex-col items-center py-2 text-center">
            <AlertTriangle size={26} className="mb-3 text-[var(--danger)]" />
            <p className="max-w-md text-sm tx">{state.message}</p>
            <button
              onClick={reset}
              className="mt-4 flex items-center gap-2 text-sm tx hover:tx-accent"
            >
              <RotateCcw size={14} />
              Try another file
            </button>
          </div>
        )}
      </div>

      {/* Honest limits, always visible. Copy from docs/content.md section 11. */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold">What it removes</h3>
          <ul className="mt-3 space-y-2 text-sm tx-muted">
            <li>Content Credentials (C2PA), the signed block naming the AI tool.</li>
            <li>The IPTC &quot;made with AI&quot; label that platforms read.</li>
            <li>Prompt and tool names stored in the file&apos;s XMP.</li>
            <li>Generation recipes a PNG carries in a text chunk.</li>
            <li>Edit history, including AI editors that ran on the file.</li>
          </ul>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold">What it does not remove</h3>
          <ul className="mt-3 space-y-2 text-sm tx-muted">
            <li>Watermarks in the picture. SynthID lives in the pixels, where no metadata tool can reach it.</li>
            <li>What a platform decides. A site can run its own AI check after you upload.</li>
            <li>A verdict either way. This removes tags, not proof of anything.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
