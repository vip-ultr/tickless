"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// Minimal typing for the install prompt event (not in default TS DOM lib).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "tickless_install_dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch + Mac platform.
  const iPadOs =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  // `standalone` is an iOS Safari extension to Navigator; not in the standard lib.
  interface StandaloneNavigator extends Navigator {
    standalone?: boolean;
  }
  const navStandalone = (navigator as StandaloneNavigator).standalone === true;
  return mq || navStandalone;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios] = useState(() => isIos());

  useEffect(() => {
    // Already installed (or dismissed before) -> never show.
    if (isStandalone()) return;
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // iOS needs a manual instruction (no programmatic prompt exists there).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (!isIos()) return;
    // Show the instructional card on iOS (after a short delay for UX).
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 md:bottom-4 md:px-0">
      <div className="glass-strong flex w-full max-w-md items-start gap-3 rounded-2xl p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/apple-touch-icon.png"
          alt="Tickless"
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tx">Add Tickless to your home screen</p>
          {ios ? (
            <p className="mt-1 text-xs tx-muted">
              Tap the Share button, then scroll and tap <span className="tx">“Add to Home Screen”</span>. The app opens without the browser bar.
            </p>
          ) : (
            <p className="mt-1 text-xs tx-muted">
              Install Tickless for quick, app-like access and one-tap downloading.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!ios && deferred && (
              <button
                onClick={install}
                className="btn-brand flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                <Download size={15} /> Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="glass flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold tx-muted hover:tx"
            >
              <X size={15} /> {ios ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-lg tx-muted hover:tx"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
