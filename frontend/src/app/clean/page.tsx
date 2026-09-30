import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CleanTool } from "@/components/CleanTool";
import { AdSlot } from "@/components/AdSlot";
import { ConsentBanner } from "@/components/ConsentBanner";

export const metadata = {
  title: "Clean - Remove AI metadata from videos and photos | Tickless",
  description:
    "Strip AI Content Credentials and generation tags from a video, photo, or MP3. The picture and the sound are never touched.",
  alternates: { canonical: "/clean" },
};

export default function CleanPage() {
  return (
    <>
      <Navbar />
      <ConsentBanner />
      <main className="mx-auto max-w-3xl px-5">
        <AdSlot slot="leaderboard" className="pt-6" />
        <section className="pt-10 md:pt-16">
          <p className="mb-4 text-sm font-medium tx-accent">Clean any file</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Strip the AI tags out of <span className="tx-accent">any file</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base tx-muted md:text-lg">
            Drop in a video, photo, or MP3. We pull out the Content Credentials and the
            generation metadata that label a file as AI-made, then hand back the same
            file. The picture and the sound are not touched.
          </p>
          <div className="mt-10">
            <CleanTool />
          </div>
        </section>
        <AdSlot slot="in_content" className="mt-16" />
      </main>
      <Footer />
    </>
  );
}
