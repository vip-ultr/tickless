"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Trash2, Upload, Loader2, Eye, EyeOff as EyeOffIcon,
  ChevronDown, Check, ImagePlus,
} from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { API_URL } from "@/lib/config";

type Ad = {
  id: string;
  slot: string;
  image_url: string;
  target_url: string;
  is_active: boolean;
  impressions: number;
  clicks: number;
  created_at: string;
};

const SLOTS = ["leaderboard", "in_content", "result"] as const;

// Recommended creative sizes shown in the admin (must match AdSlot rendering).
const SLOT_SIZE_HINTS: Record<string, string> = {
  leaderboard: "970 x 90 px (wide banner)",
  in_content: "970 x 90 px (wide banner)",
  result: "300 x 250 px",
};

const SLOT_LABELS: Record<string, string> = {
  leaderboard: "Leaderboard (top of page)",
  in_content: "In content (mid page)",
  result: "Result (after download)",
};

/** Brand-styled dropdown replacing the native <select>. */
function SlotSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {/* Hidden input keeps FormData('slot') working unchanged */}
      <input type="hidden" name="slot" value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="glass flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm tx"
      >
        <span>{SLOT_LABELS[value]}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} tx-muted`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="glass-strong absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl py-1"
        >
          {SLOTS.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={s === value}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[var(--glass-tint)] ${s === value ? "tx" : "tx-muted"}`}
              >
                <span>
                  {SLOT_LABELS[s]}
                  <span className="mt-0.5 block text-xs tx-muted">{SLOT_SIZE_HINTS[s]}</span>
                </span>
                {s === value && <Check size={15} className="shrink-0 tx-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPage() {
  // sessionStorage is client-only; read it lazily after mount without
  // a synchronous setState-in-effect (React lint rule).
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Reading external state then scheduling via rAF avoids the
    // synchronous cascading-render pattern the rule guards against.
    const id = requestAnimationFrame(() => {
      setToken(sessionStorage.getItem("tickless_admin_token"));
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return null;

  if (!token) return <Login onToken={(t) => { sessionStorage.setItem("tickless_admin_token", t); setToken(t); }} />;
  return <Dashboard token={token} onLogout={() => { sessionStorage.removeItem("tickless_admin_token"); setToken(null); }} />;
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Login failed.");
      onToken(body.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm rounded-3xl p-8">
        <Wordmark className="text-xl" />
        <p className="mt-1 text-sm tx-muted">Admin</p>
        <input name="username" placeholder="Username" autoComplete="username"
          className="glass mt-6 w-full rounded-xl px-4 py-3 text-sm outline-none tx" />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password"
          className="glass mt-3 w-full rounded-xl px-4 py-3 text-sm outline-none tx" />
        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        <button disabled={busy} className="btn-brand mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold">
          {busy && <Loader2 size={16} className="animate-spin" />} Sign in
        </button>
      </form>
    </main>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Ad | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("leaderboard");
  const [fileName, setFileName] = useState("");

  const authed = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${API_URL}${path}`, {
        ...init,
        headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
      }),
    [token],
  );

  const load = useCallback(async () => {
    const res = await authed("/api/admin/ads");
    if (res.status === 401) return onLogout();
    if (res.status === 503) { setError("Ad system not configured yet. Set the Supabase env vars on the backend."); return; }
    setAds(await res.json());
  }, [authed, onLogout]);

  useEffect(() => {
    const id = requestAnimationFrame(() => { load(); });
    return () => cancelAnimationFrame(id);
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await authed("/api/admin/ads", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Upload failed.");
      (e.target as HTMLFormElement).reset();
      setFileName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(ad: Ad) {
    const form = new FormData();
    form.set("is_active", String(!ad.is_active));
    await authed(`/api/admin/ads/${ad.id}`, { method: "PATCH", body: form });
    await load();
  }

  async function remove(ad: Ad) {
    await authed(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Wordmark className="text-xl" />
          <p className="text-sm tx-muted">Ad manager</p>
        </div>
        <button onClick={onLogout} className="text-sm tx-muted hover:tx">Sign out</button>
      </div>

      {/* Upload form */}
      <form onSubmit={create} className="glass mt-8 rounded-3xl p-5 md:p-6">
        <h2 className="font-semibold">New ad</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider tx-muted">
              Slot
            </label>
            <SlotSelect value={selectedSlot} onChange={setSelectedSlot} />
            <p className="mt-1.5 px-1 text-xs tx-muted">
              Recommended size: {SLOT_SIZE_HINTS[selectedSlot]}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider tx-muted">
              Click-through URL
            </label>
            <input
              name="target_url"
              type="url"
              required
              placeholder="https://example.com"
              className="glass w-full rounded-xl px-4 py-3 text-sm outline-none tx placeholder:tx-muted"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider tx-muted">
              Creative image
            </label>
            <label className="glass flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm">
              <ImagePlus size={16} className="shrink-0 tx-accent" />
              <span className={`truncate ${fileName ? "tx" : "tx-muted"}`}>
                {fileName || "Choose an image (PNG, JPG, WebP, GIF)"}
              </span>
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                required
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
              />
            </label>
          </div>
          <div className="flex md:items-end">
            <button
              disabled={busy}
              className="btn-brand flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Publish ad
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      </form>

      {/* Ad list */}
      <div className="mt-8 flex flex-col gap-4">
        {ads.map((ad) => (
          <div key={ad.id} className="glass rounded-2xl p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ad.image_url}
                alt=""
                className="h-24 w-full rounded-lg object-cover sm:h-16 sm:w-28 sm:shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ad.target_url}</p>
                <p className="mt-1 text-xs tx-muted">
                  {ad.slot} ({SLOT_SIZE_HINTS[ad.slot] || ""}) · {ad.impressions} views · {ad.clicks} clicks ·{" "}
                  {ad.is_active ? "active" : "paused"}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 sm:shrink-0">
                <button
                  onClick={() => toggle(ad)}
                  className="glass flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs tx-muted hover:tx"
                >
                  {ad.is_active ? <Eye size={15} /> : <EyeOffIcon size={15} />}
                  <span className="sm:hidden">{ad.is_active ? "Pause" : "Activate"}</span>
                </button>
                <button
                  onClick={() => setConfirmDelete(ad)}
                  className="glass flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs tx-muted hover:text-[var(--danger)]"
                >
                  <Trash2 size={15} />
                  <span className="sm:hidden">Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {!ads.length && !error && <p className="text-sm tx-muted">No ads yet. Publish the first one above.</p>}
      </div>

      {/* Delete confirmation modal (brand-styled, replaces native confirm) */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="glass-strong w-full max-w-sm rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">Delete this ad?</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={confirmDelete.image_url}
              alt=""
              className="mt-4 h-24 w-full rounded-xl object-cover"
            />
            <p className="mt-3 truncate text-xs tx-muted">
              {confirmDelete.slot} · {confirmDelete.target_url}
            </p>
            <p className="mt-2 text-sm tx-muted">
              The ad and its image are removed permanently. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl px-4 py-2 text-sm tx-muted hover:tx"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(confirmDelete)}
                className="flex items-center gap-2 rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white"
              >
                <Trash2 size={14} /> Delete ad
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
