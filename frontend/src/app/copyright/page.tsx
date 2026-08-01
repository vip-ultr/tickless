import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Copyright - Tickless",
  description: "How Tickless handles content ownership and rights-holder requests.",
};

export default function CopyrightPage() {
  return (
    <LegalPage title="Copyright">
      <p>
        Tickless does not host any videos. All content stays on the source platform's
        servers (TikTok, Instagram) and belongs to its respective owner. We merely help
        you retrieve a copy of content that is already publicly available on those
        platforms.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Download responsibly</h2>
      <p>
        Download only content you own or are permitted to use. You are solely
        responsible for respecting the rights of creators and rights holders.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Reporting a rights issue</h2>
      <p>
        If you are a rights holder and believe Tickless can be used to retrieve content
        that infringes your rights, we provide a takedown process. Please see our{" "}
        <Link href="/dmca" className="underline hover:tx">
          DMCA and takedown page
        </Link>{" "}
        for how to submit a request. We respond to valid requests and will disable
        access to the specific content at issue.
      </p>
    </LegalPage>
  );
}
