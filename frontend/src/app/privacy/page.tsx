import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy - Tickless",
  description: "What Tickless collects, what it does not, and your rights.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: 1 August 2026.</p>

      <h2 className="mt-6 text-base font-semibold tx">What we do not collect</h2>
      <p>
        Tickless has no accounts, no sign-up, and no user profiles. We never ask for
        your name, email, or phone number to use the service. The link you paste is
        used only to fetch the media you requested and is not stored.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Visit analytics</h2>
      <p>
        We measure traffic with cookieless, aggregated analytics. On each visit we
        compute a salted hash of your IP address using SHA-256 with a salt that rotates
        every UTC day. We never store raw IP addresses. Because the salt changes daily,
        a visitor can only be linked to activity within a single day, so records cannot
        be joined across days. This gives us unique-visitor counts without identifying
        anyone.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Download counts</h2>
      <p>
        When a download completes we record an aggregate counter (platform and media
        type, such as video or audio). No user identifier is attached to these counts.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Who we share data with</h2>
      <p>
        We do not sell data and do not share it with advertisers or third parties for
        marketing. The only data that leaves our systems is what our infrastructure
        providers need to operate the service: Vercel (frontend hosting) and Render
        (backend hosting), each bound by their own privacy terms.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Children</h2>
      <p>
        Tickless is not directed at children under 13. If you are below the age of
        digital consent in your country, use Tickless only with parental permission.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Your rights and our lawful basis</h2>
      <p>
        We process the limited data above on the basis of legitimate interest (running
        and improving the service) and, where applicable, consent. Under the EU General
        Data Protection Regulation (GDPR) and the Nigeria Data Protection Act (NDPA)
        2023 you may request information about, or deletion of, any personal data we
        hold. In practice we retain almost none, and we will confirm this on request.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Contact</h2>
      <p>
        Questions about this policy or a data request can be sent to{" "}
        <a className="underline hover:tx" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
