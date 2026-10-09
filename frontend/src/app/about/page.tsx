import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Download,
  Scissors,
  ShieldCheck,
  ShieldOff,
  EyeOff,
  BadgeCheck,
  MonitorSmartphone,
  AudioLines,
  Scale,
  HeartHandshake,
  Globe,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About - Tickless",
  description:
    "What Tickless is, why it exists, what it refuses to do, and who builds it.",
};

// The three tools, each mirroring its navbar description. Alternating accent
// colours match the homepage's feature grid.
const TOOLS = [
  {
    icon: Download,
    href: "/",
    title: "Downloader",
    body: "Paste a TikTok or Instagram link and save the clean file: no watermark, real HD when a high-resolution version exists, photo posts, and audio-only MP3s.",
  },
  {
    icon: Scissors,
    href: "/clip",
    title: "Clip",
    body: "Turn one video into several. Paste a link or upload a file, mark the segments, and export each one as a clean clip or an audio-only track.",
  },
  {
    icon: ShieldCheck,
    href: "/clean",
    title: "Clean",
    body: "Drop in a file and strip the AI metadata tags: Content Credentials, made-with-AI labels, prompt fields, generation recipes, and edit history.",
  },
];

// The promises, each one something the product actually does or refuses to do.
const PRINCIPLES = [
  {
    icon: ShieldOff,
    title: "No watermark, ever",
    body: "You get the same clean file the platform serves inside its own app, not a re-recorded copy with a logo burned into it.",
  },
  {
    icon: EyeOff,
    title: "We keep nothing",
    body: "No accounts, no download history, no copies stored on our side. Files are processed and dropped; the Clean tool deletes yours mid-response.",
  },
  {
    icon: BadgeCheck,
    title: "Actually free",
    body: "No trial, no card, no hidden export fee. A small number of clearly-labelled house ads keep the servers on, and every one of them is dismissible for the visit.",
  },
  {
    icon: MonitorSmartphone,
    title: "Nothing to install",
    body: "It runs in the browser you already have, on phone, tablet, or computer. There is no app to download and no update to ignore.",
  },
  {
    icon: AudioLines,
    title: "Audio too",
    body: "Grab just the sound as an MP3 when the picture is not what you need. Same link, same process, one fewer download for the sound-only crowd.",
  },
  {
    icon: Scale,
    title: "Honest about limits",
    body: "Marks that live in the pixels, like SynthID, survive any metadata cleaning, and a platform can run its own checks after you download. We say so instead of pretending otherwise.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pt-16">
        {/* Hero: same eyebrow + extrabold hierarchy as the homepage */}
        <p className="mb-4 text-sm font-medium tx-accent">About</p>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
          Save the video. <span className="tx-brand">Keep the reason</span> you
          wanted it.
        </h1>
        <p className="mt-5 max-w-xl text-base tx-muted md:text-lg">
          Tickless is a free, no-sign-up toolkit for saving TikTok and Instagram
          videos cleanly, cutting them into clips, and stripping AI tags off the
          files you share.
        </p>

        {/* Story */}
        <section className="glass mt-12 rounded-3xl p-8">
          <h2 className="text-xl font-bold tracking-tight">Why it exists</h2>
          <p className="mt-5 leading-relaxed tx-muted">
            Tickless started with a simple annoyance: saving a TikTok meant getting
            a video stamped with a watermark, or handing your link to a sketchy site
            covered in pop-ups. We wanted the clean file and nothing else.
          </p>
          <p className="mt-5 leading-relaxed tx-muted">
            So it does one thing and does it well. You paste a link, you get the
            video the way it was meant to look, and we do not ask for your email or
            keep a log of what you saved.
          </p>
          <p className="mt-5 leading-relaxed tx-muted">
            It grew the same way. TikTok came first, Instagram followed, and the
            tools around the downloader arrived because the same problem showed up
            again: trimming a clip meant installing an editor, and sharing a
            photo with AI tags on it meant shipping the file&apos;s whole editing
            history alongside it.
          </p>
        </section>

        {/* Tools */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            What Tickless does
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Link
                key={t.title}
                href={t.href}
                className="glass group rounded-2xl p-6 transition-transform hover:-translate-y-0.5"
              >
                <t.icon
                  size={22}
                  className={i % 2 === 0 ? "tx-brand" : "tx-accent"}
                />
                <h3 className="mt-4 font-semibold">{t.title}</h3>
                <p className="mt-2 text-sm tx-muted">{t.body}</p>
                <span className="mt-4 flex items-center gap-1.5 text-sm tx-muted transition-colors group-hover:tx">
                  Open {t.title} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Principles */}
        <section className="mt-20">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            What it will not do
          </h2>
          <p className="mt-4 tx-muted">
            Half of what makes a tool like this trustworthy is what it refuses to
            pull off. These are not marketing lines; they are the rules the
            product is built on.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="glass rounded-2xl p-6">
                <p.icon size={22} className="tx-accent" />
                <h3 className="mt-4 font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm tx-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Scope and legal posture */}
        <section className="glass mt-20 rounded-3xl p-8">
          <h2 className="text-xl font-bold tracking-tight">Where it works</h2>
          <p className="mt-5 leading-relaxed tx-muted">
            TikTok and Instagram today, in the browser, on any device. Support for
            more platforms is planned under the same roof, so one tool covers the
            places you actually post and watch.
          </p>
          <p className="mt-5 leading-relaxed tx-muted">
            Tickless is built by{" "}
            <a
              href="https://optivislabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="tx underline hover:no-underline"
            >
              Optivis Labs
            </a>
            , an independent software studio that ships real products, not demos.
            It is not affiliated with TikTok, ByteDance, Instagram, or Meta.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2 text-sm tx-muted transition-colors hover:tx"
            >
              <Globe size={14} /> Privacy policy
            </Link>
            <Link
              href="/dmca"
              className="flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2 text-sm tx-muted transition-colors hover:tx"
            >
              <HeartHandshake size={14} /> Takedowns &amp; copyright
            </Link>
            <Link
              href="/advertise"
              className="flex items-center gap-2 rounded-full border border-[var(--glass-border)] px-4 py-2 text-sm tx-muted transition-colors hover:tx"
            >
              <Scale size={14} /> Advertise with us
            </Link>
          </div>
        </section>

        {/* Closing band */}
        <section className="mt-20 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            One link. The clean file.
          </h2>
          <p className="mt-4 tx-muted">
            Paste a link and see for yourself.{" "}
            <Link href="/" className="tx underline hover:no-underline">
              Open the downloader
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
