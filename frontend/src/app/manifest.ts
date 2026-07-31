import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tickless - Video Downloader",
    short_name: "Tickless",
    description:
      "Download TikTok, Instagram Reels, and YouTube videos without watermark.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#181a1f",
    theme_color: "#1fd3e8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
