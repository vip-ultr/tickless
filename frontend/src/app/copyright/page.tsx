import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Copyright - Tickless" };

export default function CopyrightPage() {
  return (
    <LegalPage title="Copyright">
      <p>
        Tickless does not host any videos. All content stays on the source platform&apos;s servers (TikTok, Instagram).
        Download only content you own or are permitted to use. If you believe your rights are
        affected, contact us and we will respond.
      </p>
    </LegalPage>
  );
}
