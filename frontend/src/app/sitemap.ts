import type { MetadataRoute } from "next";

const BASE = "https://tickless.vercel.app";

// Every public route, with the weight it should carry in search. /clip and
// /dmca were missing here until 2026-09-27, which meant neither page was ever
// offered to crawlers through the sitemap. /admin is deliberately absent and
// is also disallowed in robots.txt.
const PAGES: Array<[path: string, priority: number]> = [
  ["", 1],
  ["/clip", 0.8],
  ["/faq", 0.7],
  ["/about", 0.6],
  ["/advertise", 0.5],
  ["/terms", 0.4],
  ["/privacy", 0.4],
  ["/copyright", 0.4],
  ["/dmca", 0.3],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, priority]) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
