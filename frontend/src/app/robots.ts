import type { MetadataRoute } from "next";

// The AI answer engines listed here are the ones that surface Tickless when
// someone asks ChatGPT, Perplexity, Claude or Gemini where to download a video.
// They are named explicitly rather than left to the default "*" rule so that a
// later blanket rule cannot quietly lock them out: per the growth strategy,
// this product has no paywall to protect, so free access to the crawlers is
// pure upside. /admin stays disallowed for every user agent.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, allow: "/", disallow: "/admin" },
      { userAgent: "*", allow: "/", disallow: "/admin" },
    ],
    sitemap: "https://tickless.vercel.app/sitemap.xml",
  };
}
