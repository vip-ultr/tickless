import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Use - Tickless",
  description: "The terms that govern your use of Tickless.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>Last updated: 1 August 2026.</p>

      <h2 className="mt-6 text-base font-semibold tx">Acceptance of terms</h2>
      <p>
        By using Tickless you agree to these Terms of Use. If you do not agree, do not
        use the service.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Not affiliated</h2>
      <p>
        Tickless is an independent product built by Optivis Labs. It is not affiliated
        with, endorsed by, or connected to TikTok, ByteDance, Instagram, or Meta
        Platforms. All trademarks are the property of their respective owners.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Eligibility</h2>
      <p>
        You must be at least 13 years old and, where your country requires it, have
        parental consent. You are responsible for complying with the laws that apply
        where you live.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Acceptable use</h2>
      <p>
        Tickless is provided for personal use. You are responsible for the content you
        download and for having the right to use it. Do not use Tickless to break the
        law, infringe the rights of others, or access material you are not permitted
        to access. Use of Tickless is also subject to the terms of the source platform
        (TikTok, Instagram). Where those terms restrict downloading or automated
        access, you use Tickless at your own risk.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Intellectual property</h2>
      <p>
        Tickless does not host any videos. All content remains on the source platform's
        servers and belongs to its respective owner. The Tickless software, brand, and
        website are the property of Optivis Labs.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Disclaimers</h2>
      <p>
        Tickless is provided as is, without warranty of any kind, express or implied.
        We do not guarantee that the service will be available, uninterrupted, or free
        of errors, or that it will continue to work if a platform changes its systems.
        We may change, limit, or pause the service at any time.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Optivis Labs is not liable for any
        indirect, incidental, or consequential damages arising from your use of
        Tickless. Nothing in these terms excludes liability that cannot legally be
        excluded.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Indemnification</h2>
      <p>
        You agree to indemnify Optivis Labs against any claim arising from your use of
        Tickless or your breach of these terms.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Changes</h2>
      <p>
        We may update these terms from time to time. Continued use after a change means
        you accept the updated terms.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Governing law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria,
        without prejudice to any mandatory consumer protections in your country of
        residence.
      </p>

      <h2 className="mt-6 text-base font-semibold tx">Contact</h2>
      <p>
        Questions about these terms can be sent to{" "}
        <a className="underline hover:tx" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
