import type { MetadataRoute } from "next";

const BASE = "https://tickless.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/faq", "/about", "/terms", "/privacy", "/copyright"].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.6,
  }));
}
