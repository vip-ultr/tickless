import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { VisitBeacon } from "@/components/VisitBeacon";
import { InstallPrompt } from "@/components/InstallPrompt";
import { API_URL } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://tickless.vercel.app"),
  title: "Tickless - TikTok & Instagram Video Downloader, No Watermark",
  description:
    "Download TikTok and Instagram videos without watermark.",
  applicationName: "Tickless",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tickless",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/apple-touch-icon-512.png", sizes: "512x512" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Tickless - TikTok & Instagram Video Downloader",
    description: "Save TikTok and Instagram videos cleanly, no watermark.",
    url: "https://tickless.vercel.app",
    siteName: "Tickless",
    type: "website",
  },
  // summary_large_image, not summary: the twitter-image / opengraph-image
  // file conventions serve a 1200x630 card, which X only renders as a large
  // preview when the card type says so.
  twitter: {
    card: "summary_large_image",
    title: "Tickless - TikTok & Instagram Video Downloader",
    description: "Save TikTok and Instagram videos cleanly, no watermark.",
  },
  alternates: { canonical: "/" },
};

// viewport-fit=cover lets safe-area-inset* work so the notch / home indicator
// don't overlap the sticky nav on iOS Safari.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
} as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} mesh-bg`}>
        {/* Warm the API origin up front. Every ad slot has to ask the backend
            which creative to show, and on a cross-origin fetch that request
            pays DNS + TCP + TLS itself -- by far the most expensive part of an
            ad's first paint. Started here, it overlaps with the HTML and JS
            download instead of waiting behind them. React 19 hoists <link>
            into <head>; "anonymous" matches the credential-less fetch. */}
        <link rel="preconnect" href={API_URL} crossOrigin="anonymous" />
        <VisitBeacon />
        <InstallPrompt />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
