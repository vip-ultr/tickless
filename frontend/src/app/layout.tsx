import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VisitBeacon } from "@/components/VisitBeacon";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://tickless.vercel.app"),
  title: "Tickless - TikTok, Instagram & YouTube Video Downloader, No Watermark",
  description:
    "Download TikTok, Instagram Reels, and YouTube videos without watermark.",
  openGraph: {
    title: "Tickless - TikTok, Instagram & YouTube Video Downloader",
    description: "Save TikTok, Instagram, and YouTube videos cleanly, no watermark.",
    url: "https://tickless.vercel.app",
    siteName: "Tickless",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tickless - TikTok, Instagram & YouTube Video Downloader",
    description: "Save TikTok, Instagram, and YouTube videos cleanly, no watermark.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} mesh-bg`}>
        <VisitBeacon />
        {children}
      </body>
    </html>
  );
}
