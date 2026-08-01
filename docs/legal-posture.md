# Legal Posture

> Founder-level summary for pitches and internal decisions. Not legal advice.
> Get a lawyer's review before raising or operating at scale.

## The core risk

Tickless helps users download content from TikTok and Instagram. Those platforms'
terms of service restrict downloading and automated access, so operating Tickless
sits in the same well-established gray area as yt-dlp, Cobalt, and Snaptik.

The realistic risk is **platform enforcement**, not litigation:

- API and signature changes that break extraction (TikTok rotates frequently).
- IP and bot-wall blocks from datacenter hosts (Render).
- Takedown or cease-and-desist requests from rights holders.

We do **not** host content, we **do not** identify users, and we **do not** sell
data. That combination removes the two exposures that normally create real legal
liability (copyright hosting and personal-data misuse).

## Why our architecture is the mitigation

Our whole engineering effort is reliability against platform enforcement, and that
same work is our legal-risk control:

- Self-hosted Cobalt + yt-dlp means no dependency on a single third-party API that
  could disappear or be served with legal strings attached.
- A PO-token provider defeats YouTube's bot wall from a datacenter IP without
  account cookies.
- Daily health-check cron catches extraction breakage before users notice.
- Per-device ad creatives and graceful error handling keep the service stable at
  scale instead of returning 500s.

The risk is "the service breaks," which is an engineering problem we own, not
"we get sued," which is the risk most people assume.

## Data and privacy

- No accounts, no emails, no profiles.
- Paste links are used only to fetch the requested media and are not stored.
- Analytics are cookieless: a daily-salted SHA-256 hash of the IP, never the raw
  IP, so visitors cannot be linked across days.
- Download counts are aggregate only (platform and type), no user identifier.
- Backed by Vercel and Render, both bound by their own privacy terms.

This posture is documented precisely in `/privacy` and `/terms`.

## Rights-holder process

- `/dmca` provides a working takedown request process with a real contact.
- We respond to valid requests and disable access to the specific content.
- A DMCA designated agent with the US Copyright Office is planned ($6 filing);
  this page will name the agent once registered.

## Governance and jurisdiction

- Operated by Optivis Labs, an independent software studio.
- Terms governed by the laws of the Federal Republic of Nigeria, without
  prejudice to mandatory consumer protections in a user's country of residence.
- Explicit non-affiliation with TikTok, ByteDance, Instagram, and Meta stated in
  the footer and Terms.

## How to talk about it in a pitch

One sentence: "Like yt-dlp and Cobalt, Tickless operates in the established gray
area of platform terms of service. Our exposure is enforcement, not litigation,
because we host no content and identify no users. Reliability against that
enforcement is the entire product, and therefore the moat."

Have a third answer ready: if a platform hard-blocks, the path is a geographic
focus, a partnership surface, or a pivot, not a shutdown.

## Cheapest things to close the gap

1. Register a DMCA agent (US Copyright Office, ~$6). Highest-value legal purchase.
2. Formally register Optivis Labs as a Nigerian entity. Low cost, gives a clean
   defendant and accelerator credibility.
3. Lawyer review of the generated Terms/Privacy and DMCA process before raising.
