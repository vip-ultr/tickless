import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ADS_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Advertise - Tickless",
  description:
    "Placement sizes, creative formats, campaign rules and contact for advertising on Tickless - three static placements aimed at creators.",
};

type Box = { w: number; h: number };

type Placement = {
  name: string;
  where: string;
  why: string;
  desktop: Box;
  desktopAlt?: string;
  mobile: Box;
  mobileAlt?: string;
};

// Sizes are not invented here: they mirror SLOT_SIZE_HINTS in the admin panel
// and SLOT_SIZES in AdSlot.tsx, which is what the creative is actually fitted
// into. Keep the three in sync or advertisers ship art that gets cropped.
const PLACEMENTS: Placement[] = [
  {
    name: "Leaderboard",
    where: "Top of the Home and Clip pages, directly under the navigation and above the headline.",
    why: "Above the fold on every device, seen before the visitor has touched the input.",
    desktop: { w: 728, h: 180 },
    desktopAlt: "970 x 180 also accepted",
    mobile: { w: 480, h: 90 },
    mobileAlt: "728 x 90 also accepted",
  },
  {
    name: "In content",
    where: "Mid-page on the Home and Clip pages, between How it works and Why Tickless.",
    why: "Read while the visitor is still deciding whether to trust the tool, not while they are typing.",
    desktop: { w: 728, h: 180 },
    mobile: { w: 480, h: 140 },
  },
  {
    name: "Result",
    where: "Immediately under the result card, after a successful download.",
    why: "The highest-attention unit on the site: the visitor just got what they came for and is still looking at the screen.",
    desktop: { w: 728, h: 250 },
    mobile: { w: 480, h: 220 },
  },
];

const SPECS: Array<[term: string, detail: string]> = [
  ["Formats", "PNG, JPEG, WebP or GIF. Static images only."],
  ["File size", "2 MB maximum per image."],
  ["Artwork", "Build to the box shown above. Desktop and mobile can be separate files; if you skip the mobile one the desktop creative is used on phones too."],
  ["Cropping", "The creative fills the box and is cover-cropped, so keep logos and copy inside the safe centre rather than hard against the edges."],
  ["Not accepted", "HTML, JavaScript, video, audio, iframes, third-party tags, or any creative that redirects through an intermediary before reaching your page."],
];

const RULES: string[] = [
  "Maximum of 3 units per page.",
  "Every unit reserves its height, so nothing on the page shifts when it loads.",
  "Every unit is labelled Ad, and readers can switch ads off for the rest of the visit.",
  "No pop-ups, no autoplaying sound, no sticky full-width overlays on mobile.",
  "Nothing is ever placed over the link input or the download button.",
  "No third-party tracking cookies are set by our ad units. If your campaign needs a pixel, say so up front and we will confirm what is possible under our consent settings.",
];

const GOOD_FIT = [
  "Video editing, captioning and subtitle tools",
  "AI voice, thumbnail and repurposing tools",
  "VPN, privacy and security products",
  "Creator education, licensing and monetisation services",
  "Research and analytics tools aimed at social teams",
];

const BAD_FIT = [
  "Adult content, gambling, or anything illegal",
  "Pop-ups, redirect chains, or download-this-app-to-unlock offers",
  "Anything that needs audio, autoplaying video, or a third-party script",
  "Malware or adware of any kind",
];

const STEPS: Array<[step: string, detail: string]> = [
  ["Email us", "Tell us the placement, the dates, the budget and the destination URL."],
  ["Get a quote", "We reply with availability for those dates and a firm figure."],
  ["Send the creative", "We check it against the spec above and load it into the slot."],
  ["Run the flight", "The campaign starts and stops on the dates agreed. Impressions and clicks are counted for every unit, so ask any time during the flight or take the totals at the end."],
];

const EMAIL_SUBJECT = "Advertising enquiry - Tickless";
const EMAIL_BODY = [
  "Company / product:",
  "Destination URL:",
  "Placement wanted (leaderboard / in content / result):",
  "Flight dates and timezone:",
  "Budget:",
  "",
  "Anything else we should know:",
].join("\n");

/** A slot drawn to the creative's own aspect ratio, so nobody has to guess. */
function SizePreview({ box, label }: { box: Box; label: string }) {
  return (
    <div className="min-w-0">
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-[var(--glass-border)] bg-[var(--bg-elevated)] px-2 text-center text-[10px] font-semibold tx-muted"
        style={{ aspectRatio: `${box.w} / ${box.h}`, width: "100%", maxWidth: `${box.w}px` }}
      >
        {box.w} x {box.h}
      </div>
      <p className="mt-1.5 text-[11px] tx-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdvertisePage() {
  const mailto = `mailto:${ADS_EMAIL}?subject=${encodeURIComponent(
    EMAIL_SUBJECT,
  )}&body=${encodeURIComponent(EMAIL_BODY)}`;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pt-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
          Advertise on <span className="tx-brand">Tickless</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed tx-muted md:text-lg">
          Three static placements, one contact, no middleman. Tell us what you are
          promoting and we come back with availability and a quote.
        </p>

        <Section title="Who you would be reaching">
          <p className="max-w-2xl text-sm leading-relaxed tx-muted">
            Tickless is a free TikTok and Instagram downloader. Visitors arrive with a
            link already copied and a task to finish: creators republishing their own
            videos, editors pulling reference clips, social teams saving posts before
            they disappear. They are here to get a file, not to browse, which is why
            the ads are static, labelled and easy to switch off.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider tx-brand">
                Good fit
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm tx-muted">
                {GOOD_FIT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider tx-muted">
                Not a fit
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm tx-muted">
                {BAD_FIT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title="Placements">
          <div className="flex flex-col gap-4">
            {PLACEMENTS.map((p) => (
              <div key={p.name} className="glass rounded-2xl p-5 md:p-6">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed tx-muted">{p.where}</p>
                <p className="mt-2 text-sm leading-relaxed tx-muted">{p.why}</p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <SizePreview box={p.desktop} label={`Desktop${p.desktopAlt ? ` - ${p.desktopAlt}` : ""}`} />
                  <SizePreview box={p.mobile} label={`Mobile${p.mobileAlt ? ` - ${p.mobileAlt}` : ""}`} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Creative spec">
          <dl className="glass divide-y divide-[color:var(--glass-border)] rounded-2xl px-5 md:px-6">
            {SPECS.map(([term, detail]) => (
              <div key={term} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold">{term}</dt>
                <dd className="text-sm leading-relaxed tx-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Rules we do not bend">
          <ul className="glass flex flex-col gap-3 rounded-2xl px-5 py-5 text-sm leading-relaxed tx-muted md:px-6">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed tx-muted">
            House promotions share the same inventory, so an unbooked slot carries our
            own ads rather than sitting blank.
          </p>
        </Section>

        <Section title="How it works">
          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map(([step, detail], i) => (
              <li key={step} className="glass rounded-2xl p-5">
                <span className="text-xs font-semibold uppercase tracking-wider tx-brand">
                  Step {i + 1}
                </span>
                <p className="mt-2 font-semibold">{step}</p>
                <p className="mt-1.5 text-sm leading-relaxed tx-muted">{detail}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Rates">
          <div className="glass rounded-2xl p-5 md:p-6">
            <p className="text-lg font-semibold">Contact for rates</p>
            <p className="mt-2 text-sm leading-relaxed tx-muted">
              We do not publish a rate card. What a placement costs depends on which
              unit you want, how long you want it for, and what else is already booked,
              so we quote per flight rather than publish a number that would be wrong
              for most people. Send your dates and budget and you get a real figure
              back. If it does not work, we will say so.
            </p>
          </div>
        </Section>

        <Section title="Contact">
          <div className="glass rounded-2xl p-5 md:p-6">
            <p className="text-sm leading-relaxed tx-muted">
              One email starts it. Include these five things and the reply can be a
              quote rather than a question:
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm tx-muted">
              <li>Company and product</li>
              <li>Destination URL</li>
              <li>Placement wanted</li>
              <li>Flight dates and timezone</li>
              <li>Budget</li>
            </ul>
            <a
              href={mailto}
              className="btn-brand mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
            >
              <Mail size={16} /> Email {ADS_EMAIL}
            </a>
            <p className="mt-3 text-xs tx-muted">
              Or copy the address by hand: <span className="tx">{ADS_EMAIL}</span>
            </p>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
