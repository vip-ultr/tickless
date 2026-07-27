import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use - Tickless" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        Tickless is provided as is, for personal use. You are responsible for what you
        download and for having the right to use it. Do not use Tickless to break the law or
        infringe on other people&apos;s work. We may change or pause the service at any time.
      </p>
    </LegalPage>
  );
}
