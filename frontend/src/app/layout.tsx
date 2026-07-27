import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://tickless.vercel.app"),
  title: "Tickless - TikTok videos, no watermark, no fuss",
  description:
    "Tickless downloads TikTok videos without the watermark in HD, straight to your device. Free, fast, no app, no sign-up.",
  openGraph: {
    title: "Tickless - Save any TikTok without the watermark",
    description: "Paste a link. Get the clean video. Done.",
    url: "https://tickless.vercel.app",
    siteName: "Tickless",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tickless - Save any TikTok without the watermark",
    description: "Paste a link. Get the clean video. Done.",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} mesh-bg`}>
        {children}
      </body>
    </html>
  );
}
