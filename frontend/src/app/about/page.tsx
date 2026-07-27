import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "About - Tickless",
  description: "What Tickless is, why it exists, and who builds it.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pt-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
          About <span className="tx-accent">Tickless</span>
        </h1>

        <div className="glass mt-10 rounded-3xl p-8">
          <p className="leading-relaxed tx-muted">
            Tickless started with a simple annoyance: saving a TikTok meant getting a video
            stamped with a watermark, or handing your link to a sketchy site covered in
            pop-ups. We wanted the clean file and nothing else.
          </p>
          <p className="mt-5 leading-relaxed tx-muted">
            So Tickless does one thing and does it well. You paste a link, you get the video
            the way it was meant to look, and we do not ask for your email or keep a log of
            what you saved.
          </p>
          <p className="mt-5 leading-relaxed tx-muted">
            It is built to grow. TikTok is the first platform. Support for more is planned
            under the same roof, so one tool covers the places you actually post and watch.
          </p>
        </div>

        <h2 className="mt-14 text-xl font-bold">Who builds this</h2>
        <p className="mt-4 tx-muted">
          Tickless is built by Optivis Labs, an independent software studio that ships real
          products, not demos.
        </p>
      </main>
      <Footer />
    </>
  );
}
