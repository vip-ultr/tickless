# Tickless growth strategy: search + AI discoverability

Written 2026-07-28 from two deep-research passes: (a) live teardown of snaptik.app and ssstik.io (HTML, sitemaps, robots.txt, Semrush traffic data), (b) GEO/AEO research on how ChatGPT, Perplexity, Gemini and AI agents source recommendations. Sources cited inline.

## The market (verified numbers)

- "download video tiktok" 16.6M searches/mo, "download tiktok" 11.1M, "tiktok mp3" 11.1M, "tiktok download" 9.1M (Semrush, Jun 2026).
- Leaders' traffic: Indonesia 21-23%, Brazil, US, Mexico, Philippines, Pakistan. Nigeria is snaptik's number 5 market: 5.05%, 2.49M visits/mo. 86-97% mobile.
- 20-30% of leaders' traffic is branded search ("snaptik"). Brand is the moat, built later.
- Leaders have Authority Score 80-96 and 6K+ referring domains. Head terms are unreachable for a new site. Entry is long-tails and local-language queries.

## Decision 0 (blocking): custom domain

tickless.vercel.app cannot build authority: Google discounts freehost subdomains, directories and listicles will not take it seriously, and any later migration loses equity. Buy a cheap domain (~$2-10/yr, .com/.net/.app all fine, do NOT put "tiktok" in the name, trademark risk) BEFORE building backlinks. This is the one paid item in the whole plan and everything compounds on it.

## Phase 1: on-page SEO (copy the winners exactly)

1. Title pattern: exact-match keyword first, brand last. "TikTok Downloader - Download TikTok Videos Without Watermark | Tickless". H1 "TikTok Video Downloader", H2 "Download TikTok videos online".
2. Grow the FAQ to ~13 keyword-loaded Q&A pairs (snaptik's count), one per intent: no watermark, HD, mp3, iPhone/Android, is it free, is it legal, slideshow, story, etc. Visible text AND FAQPage JSON-LD.
3. Visible 3-step How-To section + HowTo JSON-LD.
4. WebApplication JSON-LD (applicationCategory MultimediaApplication). Never fake AggregateRating (ssstik self-asserts 4.9/297k reviews; it works until Google nukes it).
5. Feature subpages, each 1 click from home, each with own FAQ: /mp3, /story, /slideshow. Later /instagram as the second keyword surface (snapinsta model).
6. Language subpages with hreflang in head AND sitemap xhtml:link alternates, x-default en. Start with the traffic geography: id, pt, es, ar, fil/tl, hi, ha (Hausa: home advantage, zero competition).
7. robots.txt: disallow crawl of ?url= result params (infinite duplicate URLs), declare sitemap.
8. Keep CWV tight on mid-range Android: LCP < 2.5s, no heavy ad scripts.

## Phase 2: AI/agent discoverability (GEO)

How AI assistants pick tools: ChatGPT Search = Bing index + OAI-SearchBot; Gemini/AI Overviews = Google index; Perplexity = own crawler. RAG cites pages that already rank and that answer the question in the first 2 sentences. Key citation sources by engine (Profound, 30M citations): ChatGPT number 1 = Wikipedia, Perplexity number 1 = Reddit (46.7% of top-10), AI Overviews number 1 = Reddit.

1. robots.txt: ALLOW GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, CCBot. OpenAI docs: blocking OAI-SearchBot = never shown in ChatGPT search. Check Vercel bot protection is not silently blocking them; verify with knowatoa.com (free).
2. Bing Webmaster Tools: verify, submit sitemap, enable IndexNow. Single highest-leverage step for ChatGPT visibility. Plus Google Search Console obviously.
3. GEO content patterns (Princeton paper, arXiv 2311.09735: +30-40% AI visibility, and low-ranked sites benefit most, +115% for rank-5 sites): open the landing page with a direct 2-sentence answer to "how do I download a TikTok without watermark", add real statistics with cited sources, quote sources. Keyword stuffing performs WORSE than baseline for AI answers.
4. Publish an honest comparison page: "Tickless vs SnapTik vs SSSTik" (comparison pages are the highest-value single content type for AI recommendations; engines answer "best tiktok downloader" by retrieving existing comparisons).
5. llms.txt: 15 minutes, near-zero risk, speculative upside. Ship it, expect nothing.

## Phase 3: seeding (all free)

1. AlternativeTo listing (high authority, cited in "alternatives" AI queries).
2. Product Hunt launch (PH pages rank and get cited).
3. Public GitHub repo or at least a public README repo describing the tool (GitHub is heavily represented in training corpora).
4. Show HN post.
5. Genuine Reddit answers in r/tiktokhelp etc. threads asking how to download without watermark. Reddit feeds Perplexity, AI Overviews, and OpenAI/Google training via licensing deals. Never spam.
6. Wikidata item (Wikipedia article is out of notability reach).
7. Email authors of existing "best TikTok downloader" listicles asking for inclusion (many update annually).

## Phase 4: agent integration (differentiator)

Precedent: kevinwatt/yt-dlp-mcp is a popular MCP server giving Claude/LLMs TikTok download tools. Tickless already has a FastAPI backend.

1. Thin MCP server wrapping the API: one download_tiktok(url) tool, Python mcp SDK, ~1 day.
2. Publish to PyPI/npm, submit to registry.modelcontextprotocol.io, Smithery, mcp.so, awesome-mcp-servers, LobeHub, PulseMCP. Each listing is also a crawlable backlink.
3. Documented public REST endpoint + OpenAPI spec so AI browser agents can call it directly.

## Risks (from the SEO research)

- AdSense rejects downloader sites routinely; monetization in this niche is pop/push networks which hurt trust and CWV. Keep the self-served ad system, delay external networks until traffic exists.
- DMCA/legal: Yout v RIAA went against the stream-ripper. Mitigations already in place or cheap: never host/cache videos (we stream and delete), DMCA/contact page, ToS wording "download your own content or with permission", no "tiktok" in domain.
- TikTok breaks scrapers periodically and sends C&Ds; leaders rotate clone domains. Expect volatility, keep yt-dlp updated (health cron already watches extraction).

## Realistic timeline

- Months 0-3: indexing, zero-volume long-tails, Nigerian/African local-language queries.
- Months 3-9: mid-tails ("tiktok story downloader", "tiktok to mp3 converter online").
- Head terms: only after thousands of referring domains. The compounding assets are the domain, the language pages, the comparison page, and branded search.

## Execution order

1. Custom domain (blocking, user decision)
2. Phase 1 items 1-4 + robots/sitemap fixes (one dev day)
3. Bing WMT + GSC + IndexNow + AI-crawler robots.txt (half day)
4. Comparison page + GEO landing rewrite (one day)
5. Directory/GitHub/PH/HN seeding (spread over 2 weeks)
6. Language subpages (iterative, 2-3 per week)
7. MCP server + registries (one day, after custom domain)
8. Instagram downloader under /instagram with its own FAQ/HowTo/hreflang cluster (repeat Phase 1)
