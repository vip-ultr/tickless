import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy - Tickless" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        Tickless does not require an account and does not store the videos you download or a
        history of your activity. We do not sell data. Basic, anonymous traffic stats may be
        used to keep the service running. Links you paste are used only to fetch that video
        and are not retained.
      </p>
    </LegalPage>
  );
}
