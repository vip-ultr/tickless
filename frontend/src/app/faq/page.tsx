import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "FAQ - Tickless",
  description: "Questions about Tickless, answered. Free TikTok and Instagram downloads without the watermark.",
};

const FAQS = [
  {
    q: "Is Tickless free?",
    a: "Yes. There is no charge, no trial, and no card required. If ads appear later they are only there to cover server costs.",
  },
  {
    q: "Do I need an account or an app?",
    a: "No. Tickless runs in your browser. There is nothing to sign up for and nothing to install.",
  },
  {
    q: "How does the no-watermark part work?",
    a: "TikTok stores a clean version of every video on its own servers, which is the copy its app plays. Tickless fetches that clean version for you. Nothing is edited or re-recorded, so quality stays intact.",
  },
  {
    q: "What links are supported?",
    a: "TikTok links (tiktok.com/@user/video/123, short links like vm.tiktok.com/xxxx) and Instagram links (instagram.com/reel/xxxx, instagram.com/p/xxxx). Links copied straight from either app's Share menu work.",
  },
  {
    q: "Does it work with Instagram?",
    a: "Yes. Paste an Instagram Reel or video post link in the same box and Tickless detects it automatically. Public posts only, and photo carousels are not supported yet.",
  },
  {
    q: "Can I download the audio only?",
    a: "Yes. When a video is ready you can choose to save just the audio as an MP3.",
  },
  {
    q: "Do you store the videos I download?",
    a: "No. Tickless does not keep the videos or a record of what you download. The file goes from the platform to your device.",
  },
  {
    q: "Why is the first download sometimes slow?",
    a: "On the free server plan the backend sleeps after a quiet period and takes a few seconds to wake up. After that first request it is fast.",
  },
  {
    q: "Can I download photo slideshows?",
    a: "Not yet. Video posts work now. Turning photo slideshows into a video is on the way.",
  },
  {
    q: "Is this legal?",
    a: "Tickless is a tool. Download content you own or have permission to use, and respect the rights of creators. See the Copyright page for details.",
  },
];

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pt-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
          Questions, <span className="tx-brand">answered</span>.
        </h1>
        <div className="mt-10 flex flex-col gap-4">
          {FAQS.map((f) => (
            <details key={f.q} className="glass group rounded-2xl px-6 py-5">
              <summary className="cursor-pointer list-none font-semibold marker:content-none">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed tx-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
