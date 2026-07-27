"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Upload, Loader2, Eye, EyeOff as EyeOffIcon } from "lucide-react";
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
  in_content: "300 x 250 px",
  result: "300 x 250 px",
};

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
      <form onSubmit={create} className="glass mt-8 rounded-3xl p-6">
        <h2 className="font-semibold">New ad</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <select
              name="slot"
              required
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-sm outline-none tx bg-transparent"
            >
              {SLOTS.map((s) => <option key={s} value={s} className="bg-[#111827]">{s}</option>)}
            </select>
            <p className="mt-1.5 px-1 text-xs tx-muted">
              Recommended size: {SLOT_SIZE_HINTS[selectedSlot]}
            </p>
          </div>
          <input name="target_url" type="url" required placeholder="Click-through URL"
            className="glass rounded-xl px-4 py-3 text-sm outline-none tx" />
          <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required
            className="glass rounded-xl px-4 py-2.5 text-sm tx-muted file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--text-on-brand)]" />
          <button disabled={busy} className="btn-brand flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Publish ad
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      </form>

      {/* Ad list */}
      <div className="mt-8 flex flex-col gap-4">
        {ads.map((ad) => (
          <div key={ad.id} className="glass flex items-center gap-4 rounded-2xl p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ad.image_url} alt="" className="h-16 w-28 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ad.target_url}</p>
              <p className="mt-1 text-xs tx-muted">
                {ad.slot} ({SLOT_SIZE_HINTS[ad.slot] || ""}) · {ad.impressions} views · {ad.clicks} clicks ·{" "}
                {ad.is_active ? "active" : "paused"}
              </p>
            </div>
            <button onClick={() => toggle(ad)} title={ad.is_active ? "Pause" : "Activate"} className="tx-muted hover:tx">
              {ad.is_active ? <Eye size={18} /> : <EyeOffIcon size={18} />}
            </button>
            <button onClick={() => setConfirmDelete(ad)} title="Delete" className="tx-muted hover:text-[var(--danger)]">
              <Trash2 size={18} />
            </button>
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
