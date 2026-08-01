import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "DMCA & Takedown - Tickless",
  description: "How rights holders can request removal of access to specific content.",
};

export default function DmcaPage() {
  return (
    <LegalPage title="DMCA & Takedown Requests">
      <p>Last updated: 1 August 2026.</p>

      <p>
        Tickless does not host any content. It retrieves publicly available media from
        the source platform&apos;s own servers at the user&apos;s request. We respond to good
        faith takedown requests from rights holders and will disable access to the
        specific content at issue.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Before you submit</h2>
      <p>
        A takedown request must identify the specific content and explain your rights to
        it. Generic or automated complaints that do not identify specific material cannot
        be processed. Submitting a knowingly false claim may carry legal consequences.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">What to include</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Your name and the entity you represent.</li>
        <li>
          A description of the copyrighted work you claim is affected, and your ownership
          or authorization to act for the owner.
        </li>
        <li>
          The exact URL or links you submitted to Tickless (the content link, not our
          website).
        </li>
        <li>
          A statement that you have a good faith belief the use is not authorized by the
          owner, its agent, or the law.
        </li>
        <li>
          A statement, under penalty of perjury, that the information you provide is
          accurate and that you are authorized to act on behalf of the owner.
        </li>
        <li>Your contact information (email and, if available, postal address).</li>
      </ul>

      <h2 className="mt-6 text-base font-semibold tx">How to submit</h2>
      <p>
        Email your request to{" "}
        <a className="underline hover:tx" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{" "}
        with the subject line <span className="tx">Takedown request</span>. We aim to
        review and act on valid requests within 10 business days.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Counter notice</h2>
      <p>
        If you believe content was taken down in error, you may send a counter notice
        with the same contact details. We will review it and, where appropriate, restore
        access.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Designated agent</h2>
      <p>
        Tickless plans to register a designated agent with the United States Copyright
        Office. Until that registration is complete, requests should be sent to the
        contact above. This page will be updated with the agent details when registered.
      </p>
    </LegalPage>
  );
}
