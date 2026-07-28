import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Downloader } from "@/components/Downloader";
import { AdSlot } from "@/components/AdSlot";
import { ConsentBanner } from "@/components/ConsentBanner";
import { ShieldOff, Sparkles, MonitorSmartphone, EyeOff, BadgeCheck, AudioLines } from "lucide-react";

const STEPS = [
  { n: "1", title: "Copy the link", body: "In TikTok or Instagram, tap Share, then Copy link." },
  { n: "2", title: "Paste it here", body: "Drop the link in the box above and hit Download." },
  { n: "3", title: "Save the clean file", body: "Pick HD, standard, or audio, and it saves straight to your device." },
];

const FEATURES = [
  { icon: ShieldOff, title: "No watermark", body: "You get the same clean file TikTok serves inside its own app, not a re-recorded copy." },
  { icon: Sparkles, title: "Real HD", body: "When a high-resolution version exists, that is what you get. No quality loss." },
  { icon: MonitorSmartphone, title: "Nothing to install", body: "It runs in your browser on your phone, tablet, or computer." },
  { icon: EyeOff, title: "We keep nothing", body: "No accounts, no download history, no copies stored on our side." },
  { icon: BadgeCheck, title: "Actually free", body: "No trial, no card, no hidden export fee. Ads keep the lights on later, that is it." },
  { icon: AudioLines, title: "Audio too", body: "Grab just the sound as an MP3 when that is all you need." },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <ConsentBanner />
      <main className="mx-auto max-w-3xl px-5">
        {/* Ad: top leaderboard (zero footprint when empty) */}
        <AdSlot slot="leaderboard" className="pt-6" />
        {/* Hero */}
        <section className="pt-10 md:pt-16">
          <p className="mb-4 text-sm font-medium tx-brand">Free TikTok &amp; Instagram downloader</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Save any TikTok without the <span className="tx-brand">watermark</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base tx-muted md:text-lg">
            Paste the link, pick your quality, and the clean video lands on your device in seconds. Works with Instagram Reels too. No app to install, no account to make.
          </p>
          <div className="mt-10">
            <Downloader />
          </div>
        </section>

        {/* How it works */}
        <section className="mt-28">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="glass rounded-2xl p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[oklch(0.86_0.19_130_/_0.15)] font-bold tx-accent">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm tx-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ad: in-content between How-it-works and Why (zero footprint when empty) */}
        <AdSlot slot="in_content" className="mt-16" />

        {/* Why Tickless */}
        <section className="mt-24">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Why Tickless</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="glass rounded-2xl p-6">
                <f.icon
                  size={22}
                  className={i % 2 === 0 ? "tx-brand" : "tx-accent"}
                />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm tx-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing band */}
        <section className="mt-24 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            One box. TikTok and Instagram.
          </h2>
          <p className="mt-4 tx-muted">Paste a link above and see for yourself.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
