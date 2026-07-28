import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Downloader } from "@/components/Downloader";
import { AdSlot } from "@/components/AdSlot";
import { ConsentBanner } from "@/components/ConsentBanner";
import { ShieldOff, Sparkles, MonitorSmartphone, EyeOff, BadgeCheck, AudioLines } from "lucide-react";

export const metadata: Metadata = {
  title: "Instagram Video Downloader - Download Reels in HD | Tickless",
  description:
    "Download Instagram Reels and videos in HD for free. Paste the link, get the clean file. No app, no account, no watermark added. Works on phone and desktop.",
  alternates: { canonical: "/instagram" },
};

const STEPS = [
  { n: "1", title: "Copy the link", body: "In Instagram, tap the 3 dots (or Share), then Copy link." },
  { n: "2", title: "Paste it here", body: "Drop the link in the box above and hit Download." },
  { n: "3", title: "Save the file", body: "Pick video or audio, and it saves straight to your device." },
];

const FEATURES = [
  { icon: ShieldOff, title: "Clean original file", body: "You get the file Instagram serves in its own app. Nothing re-recorded, nothing stamped on top." },
  { icon: Sparkles, title: "Real HD", body: "When a high-resolution version exists, that is what you get. No quality loss." },
  { icon: MonitorSmartphone, title: "Nothing to install", body: "It runs in your browser on your phone, tablet, or computer." },
  { icon: EyeOff, title: "We keep nothing", body: "No accounts, no download history, no copies stored on our side." },
  { icon: BadgeCheck, title: "Actually free", body: "No trial, no card, no hidden export fee." },
  { icon: AudioLines, title: "Audio too", body: "Grab just the sound as an MP3 when that is all you need." },
];

const FAQS = [
  {
    q: "How do I download an Instagram Reel?",
    a: "Open the Reel in Instagram, tap the 3 dots or the Share icon, choose Copy link, paste it in the box above, and hit Download. The video saves straight to your device.",
  },
  {
    q: "Can I download Instagram videos in HD?",
    a: "Yes. Tickless grabs the highest resolution Instagram serves for that post. If the creator uploaded in 1080p, that is what you download.",
  },
  {
    q: "Does it work for private accounts?",
    a: "No. Tickless only works with public posts and Reels. We never ask for your Instagram login and you should not give it to any downloader site.",
  },
  {
    q: "Can I download photo posts or carousels?",
    a: "Not yet. Video posts and Reels work today. Photo and carousel support is on the roadmap.",
  },
  {
    q: "Is it legal to download Instagram videos?",
    a: "Downloading your own content or content you have permission to use is fine. Downloading someone else's work to repost without credit or permission may violate copyright and Instagram's terms. Tickless is built for personal, fair use.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. Tickless runs entirely in your browser on any phone, tablet, or computer.",
  },
];

export default function InstagramPage() {
  return (
    <>
      <Navbar />
      <ConsentBanner />
      <main className="mx-auto max-w-3xl px-5">
        <AdSlot slot="leaderboard" className="pt-6" />
        {/* Hero */}
        <section className="pt-10 md:pt-16">
          <p className="mb-4 text-sm font-medium tx-brand">Free Instagram downloader</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Download Instagram <span className="tx-brand">Reels</span> in HD.
          </h1>
          <p className="mt-5 max-w-xl text-base tx-muted md:text-lg">
            Paste the link and the clean video lands on your device in seconds. Works for Reels and video posts. No app to install, no account to make.
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

        <AdSlot slot="in_content" className="mt-16" />

        {/* Why Tickless */}
        <section className="mt-24">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Why Tickless</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="glass rounded-2xl p-6">
                <f.icon size={22} className={i % 2 === 0 ? "tx-brand" : "tx-accent"} />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm tx-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-24">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Instagram downloads, answered</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((f) => (
              <details key={f.q} className="glass group rounded-2xl p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm tx-muted">{f.a}</p>
              </details>
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
      {/* FAQPage structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </>
  );
}
