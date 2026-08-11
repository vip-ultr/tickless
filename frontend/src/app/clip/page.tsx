import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ClipEditor } from "@/components/ClipEditor";
import { AdSlot } from "@/components/AdSlot";
import { ConsentBanner } from "@/components/ConsentBanner";

export const metadata = {
  title: "Clip - Trim TikTok & Instagram videos into clips | Tickless",
  description:
    "Trim any TikTok, Instagram, or YouTube video into clean clips. Cut one long video into many segments, or grab just the audio.",
  alternates: { canonical: "/clip" },
};

export default function ClipPage() {
  return (
    <>
      <Navbar />
      <ConsentBanner />
      <main className="mx-auto max-w-3xl px-5">
        <AdSlot slot="leaderboard" className="pt-6" />
        <section className="pt-10 md:pt-16">
          <p className="mb-4 text-sm font-medium tx-accent">Clip any video</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Turn one video into <span className="tx-accent">clean clips</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base tx-muted md:text-lg">
            Paste a link or upload a video from your device, mark the parts you want,
            and grab each clip. Audio-only too. Nothing is stored on our side.
          </p>
          <div className="mt-10">
            <ClipEditor />
          </div>
        </section>
        <AdSlot slot="in_content" className="mt-16" />
      </main>
      <Footer />
    </>
  );
}
