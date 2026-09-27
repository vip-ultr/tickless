# Tickless — Website Content & Copy (LOCKED)

> **Status:** Source of truth for every user-facing string. Reconciled against
> the code on 2026-09-27.
> **Written:** 2026-07-27 · **Last reconciled:** 2026-09-27
> **Rule:** every word that appears on the Tickless website is written here
> first, and the build uses this copy verbatim. When the site and this document
> disagree, this document is the target and the site holds the bug: fix this
> file first, then the code.
>
> **Copy rules (enforced):** No em-dashes (—). No AI-filler phrases ("empower",
> "seamlessly", "unlock", "elevate", "in today's fast-paced world"). Plain,
> specific, confident. Quantities as digits. Human voice.

Section 10 records what was corrected at the last reconciliation.

---

## 0. Global

- **Product name:** Tickless
- **Title tag:** Tickless - TikTok & Instagram Video Downloader, No Watermark
- **Meta description:** Download TikTok and Instagram videos without watermark.
- **OG / Twitter title:** Tickless - TikTok & Instagram Video Downloader
- **OG / Twitter description:** Save TikTok and Instagram videos cleanly, no watermark.
- **Domain (for now):** tickless.vercel.app
- **Tagline (primary, reserved):** TikTok videos, no watermark, no fuss.
- **Tagline (alt, reserved):** Paste a link. Get the clean video. Done.

Both taglines were written for launch copy and are currently rendered nowhere
in the UI. They are kept for social bios and ads, not for the site.

---

## 1. Navigation

Links, in this order (desktop bar and mobile bottom sheet):
- Home
- Clip
- FAQ
- About

Mobile bottom sheet only (not shown on the desktop bar):
- Sheet header: "Menu"
- Home description: "Paste a link, get the clean video"
- Clip description: "Trim a video into clips"
- FAQ description: "Questions, answered"
- About description: "What Tickless is and who builds it"
- Sheet footer: "Tickless by Optivis Labs"

CTA button label (nav): "Paste a link"
Menu aria-labels: "Open menu" and "Close menu"

Footer columns:
- Product: Home, FAQ
- Company: About
- Legal: Terms, Privacy, Copyright, DMCA

The footer also carries a "Cookie settings" button that reopens the consent
preferences.

---

## 2. Home page

### Hero
- **Eyebrow:** Free TikTok & Instagram downloader
- **Headline:** Save any TikTok or Instagram video without the watermark.
- **Subhead:** Paste the link and the clean video lands on your device in seconds. No app to install, no account to make.
- **Input placeholder:** Paste your TikTok or Instagram link
- **Input aria-label:** TikTok or Instagram link
- **Primary button:** Download
- **Paste button (small):** Paste
- **Microtrust line under input:** Works with tiktok.com, vm.tiktok.com, instagram.com and short links.

### Result card (after extract)
- **Meta line:** title, platform (TikTok / Instagram), @creator handle, duration, resolution (for example "720p").
- **Actions:** Download and Audio (MP3).
- **Gallery posts** (TikTok photo posts, Instagram carousels, and single-image posts) render one chip per item: "Photo 1", "Video 1", and so on.
- **Gallery actions:** Select all; Download (N) once two or more chips are staged; Clear to unstage.
- **Staged status line:** Preparing your files…

There is no quality selector. The card offers one video file plus audio.

### Loading / states copy
- Extracting: "Reading the video..." (with skeleton placeholders)
- Server waking (Render cold start): "Waking up the server, this takes a few seconds on the first request."

### Error copy

Served by the backend from `ERROR_MESSAGES` in `backend/main.py`. The frontend
renders `detail` verbatim, so these strings are the copy:

- Nothing pasted: "Paste a TikTok, Instagram, or YouTube link to get started."
- Link too long: "That link is too long to be a real video URL."
- Not a supported link: "That does not look like a TikTok, Instagram, or YouTube link. Check it and try again."
- Unreachable: "We could not reach this video. It may be private, removed, or region locked."
- Nothing found at the link: "We could not find any photos or video at that link."
- Generic: "Something went wrong on our side. Give it another try in a moment."
- Instagram service down: "Our Instagram service is temporarily unavailable. Try again in a few minutes."
- Instagram warming up: "Our Instagram service is starting up. Give it about 30 seconds and try again."
- Instagram blocking us: "Instagram is blocking our server right now. Try again in a few minutes."
- Instagram rate limit on photo posts: "Instagram is rate-limiting downloads from this server's IP right now, which affects photo posts. Reels usually still work. This is a known Instagram limitation for self-hosted instances (the official cobalt.tools works because it uses proxies). It may clear up on its own, or a proxy/different IP is the real fix."

### How it works (3 steps)
1. **Copy the link.** In TikTok or Instagram, tap Share, then Copy link.
2. **Paste it here.** Drop the link in the box above and hit Download.
3. **Save the clean file.** It lands straight on your device. Take the video, or grab just the audio as an MP3.

### Why Tickless (features, real copy, no filler)
- **No watermark.** You get the same clean file TikTok serves inside its own app, not a re-recorded copy.
- **Real HD.** When a high-resolution version exists, that is what you get. No quality loss.
- **Nothing to install.** It runs in your browser on your phone, tablet, or computer.
- **We keep nothing.** No accounts, no download history, no copies stored on our side.
- **Actually free.** No trial, no card, no hidden export fee. Ads keep the lights on later, that is it.
- **Audio too.** Grab just the sound as an MP3 when that is all you need.

### Closing band
- **Heading:** One box. TikTok and Instagram.
- **Text:** Paste a link above and see for yourself.

---

## 3. FAQ page

- **Title tag:** FAQ - Tickless
- **Meta description:** Questions about Tickless, answered. Free TikTok and Instagram downloads without the watermark.
- **Heading:** Questions, answered.

Q: Is Tickless free?
A: Yes. There is no charge, no trial, and no card required. If ads appear later they are only there to cover server costs.

Q: Do I need an account or an app?
A: No. Tickless runs in your browser. There is nothing to sign up for and nothing to install.

Q: How does the no-watermark part work?
A: TikTok stores a clean version of every video on its own servers, which is the copy its app plays. Tickless fetches that clean version for you. Nothing is edited or re-recorded, so quality stays intact.

Q: What links are supported?
A: TikTok links (tiktok.com/@user/video/123, short links like vm.tiktok.com/xxxx) and Instagram links (instagram.com/reel/xxxx, instagram.com/p/xxxx). Links copied straight from either app's Share menu work.

Q: Does it work with Instagram?
A: Yes. Paste an Instagram Reel or video post link in the same box and Tickless detects it automatically. Public posts only. Photo carousels work too, and you can save each image or hit Select all to take the whole set.

Q: Can I download the audio only?
A: Yes. When a video is ready you can choose to save just the audio as an MP3.

Q: Do you store the videos I download?
A: No. Tickless does not keep the videos or a record of what you download. The file goes from the platform to your device.

Q: Why is the first download sometimes slow?
A: On the free server plan the backend sleeps after a quiet period and takes a few seconds to wake up. After that first request it is fast.

Q: Can I download photo slideshows?
A: Yes. Paste a TikTok or Instagram photo post link and every image shows up as its own item. Save one at a time, or hit Select all to stage every image and then Download to get the whole set.

Q: Is this legal?
A: Tickless is a tool. Download content you own or have permission to use, and respect the rights of creators. See the Copyright page for details.

---

## 4. About page

- **Heading:** About Tickless

Body:
Tickless started with a simple annoyance: saving a TikTok meant getting a video stamped with a watermark, or handing your link to a sketchy site covered in pop-ups. We wanted the clean file and nothing else.

So Tickless does one thing and does it well. You paste a link, you get the video the way it was meant to look, and we do not ask for your email or keep a log of what you saved.

It is built to grow. TikTok came first, Instagram is here now. Support for more platforms is planned under the same roof, so one tool covers the places you actually post and watch.

- **Sub-heading:** Who builds this
Tickless is built by Optivis Labs, an independent software studio that ships real products, not demos.

---

## 5. Footer

- Wordmark: Tickless
- Short line: The clean way to save TikTok and Instagram videos.
- Columns:
  - Product: Home, FAQ
  - Company: About
  - Legal: Terms, Privacy, Copyright, DMCA
- Button: Cookie settings
- Bottom line: (c) 2026 Tickless by Optivis Labs. Not affiliated with TikTok, ByteDance, Instagram, or Meta.

---

## 6. Legal pages

The shipped pages are full documents, not the one-line summaries this section
originally held. The summaries below are the gist; the pages themselves are
authoritative. Terms carries its own "Last updated: 1 August 2026" stamp.

### Terms (/terms)
- **Heading:** Terms of Use
- **Gist:** provided as is, for personal use; you are responsible for what you download and for having the right to use it; no unlawful or infringing use; non-affiliation; disclaimers, limitation of liability, indemnification, changes, governing law of the Federal Republic of Nigeria, contact.
- **Full copy lives in** `frontend/src/app/terms/page.tsx`.

### Privacy (/privacy)
- **Heading:** Privacy Policy
- **Gist:** no account, no stored videos, no download history, no sale of data; visit analytics on a daily-salted SHA-256 hash of the IP, never the raw IP; aggregate download counts with no user identifier; processors are Vercel and Render; children; rights and lawful basis under GDPR and the NDPA; contact.
- **Full copy lives in** `frontend/src/app/privacy/page.tsx`.

### Copyright (/copyright)
- **Heading:** Copyright
- **Verbatim:** All content stays on the source platform's servers (TikTok, Instagram) and belongs to its respective owner. We merely help you retrieve a copy of content that is already publicly available on those platforms.
- Download only content you own or are permitted to use. Links to the DMCA page.

### DMCA (/dmca)
- **Heading:** DMCA & Takedown Requests
- Takedown instructions, a 10-business-day response window, counter notices, and designated agent details.
- **Full copy lives in** `frontend/src/app/dmca/page.tsx`.

---

## 7. Small UI strings (buttons, toasts, a11y)

- Nav open (mobile) button aria-label: "Open menu"
- Nav close button aria-label: "Close menu"
- Input aria-label: "TikTok or Instagram link"
- Gallery chip labels: "Photo 1", "Video 1", ... (chip carries `aria-pressed`)
- Gallery buttons: "Select all", "Download (N)", "Clear" (Clear's aria-label: "Clear selection")
- Staged status: "Preparing your files…"
- Result meta platform prefix: "Instagram · " or "TikTok · "
- 404 heading: "This page took a walk."
- 404 body: "The link is broken or the page moved. Head back home and try again."
- 404 button: "Back to home"

### PWA install prompt
- Title: "Add Tickless to your home screen"
- Body: "Install Tickless for quick, app-like access..."
- Buttons: "Install", "Got it", "Not now"

### Cookie consent banner
- Heading: "Cookies at Tickless"
- Body: "We use a few cookies to understand traffic and, later, to support ads that keep Tickless free. You choose what is allowed."
- Buttons: "Accept all", "Only necessary", "Manage choices"
- Preferences modal: heading "Cookie choices"; categories "Strictly necessary", "Analytics", "Advertising"; button "Save choices"

### Ad slots
- Creative alt text: "Advertisement"
- Cancel control aria-label: "Cancel ads for this visit"
- Visible badge labels: "Ad" and "Visit"

> **Removed:** the three toasts originally specified here ("Link pasted.",
> "Your download is starting.", "Copied.") were never built. The frontend has
> no toast system; downloads are native `<a href>` navigations. Do not write
> copy for them until a toast component exists.

---

## 8. Social / launch copy (for reserved handles)

- **Bio (X/IG):** Save TikTok and Instagram videos without the watermark. Free, no app, no sign-up. Built by Optivis Labs.
- **Pinned/launch post:** Tickless is live. Paste a TikTok or Instagram link, get the clean video in HD, no watermark and no account. Free to use. [link]

---

## 9. Clip page

- **Title tag:** Clip - Trim TikTok & Instagram videos into clips | Tickless
- **Meta description:** Trim any TikTok, Instagram, or YouTube video into clean clips. Cut one long video into many segments, or grab just the audio.
- **Eyebrow:** Clip any video
- **Headline:** Turn one video into clean clips.
- **Subhead:** Paste a link or upload a video from your device, mark the parts you want, and grab each clip. Audio-only too. Nothing is stored on our side.
- Editor controls live in `frontend/src/components/ClipEditor.tsx` and are not enumerated here yet.

---

## 10. Reconciliation log

**2026-09-27 — first reconciliation since the document was written on
2026-07-27.** A full read of the frontend against this document found the
following. Corrected copy above; the two copy bugs this pass exposed were fixed
in the site the same day, and the one item still outstanding is at the end.

Corrected here because the site had already moved on:
- Instagram added everywhere: title, meta, OG, hero eyebrow and headline, input placeholder and aria-label, microtrust line, How-it-works step 1, closing band, About paragraph 3, footer line and non-affiliation line, FAQ.
- Nav gained **Clip**; the footer gained **DMCA** and the **Cookie settings** button; the mobile sheet gained a header, per-link descriptions and a footer line.
- FAQ: "What links are supported?" rewritten for both platforms; a new "Does it work with Instagram?" question added; "Do you store..." now says "the platform"; "Can I download photo slideshows?" changed from "Not yet" to a working answer.
- The slideshow "coming soon" teaser was deleted from the site, so it is gone from here.
- Result-card copy replaced: there are no "HD video" / "Standard" quality labels and no "Download another" button. The card's real controls and meta line are now documented.
- Error copy moved into its own subsection and matches `ERROR_MESSAGES` exactly, including the four Instagram-specific messages that did not exist before.
- Legal section now points at the four shipped pages instead of pretending they are one paragraph each.
- Added sections for the Clip page, the PWA prompt, the consent banner and ad-slot strings, none of which existed when this was written.
- Removed the three toast strings, which were never built.

Fixed in the site on 2026-09-27, the same day as this pass:
- The two FAQ answers that said "use **Download all**" and "hit **Download
  all**" now say "hit **Select all**" and "hit **Select all** to stage every
  image and then **Download**". There is no "Download all" button and there
  has not been since multi-select landed.
- The hero subhead and How-it-works step 3 no longer promise a quality
  picker. Neither string mentions quality now, so this document and the site
  agree again. A real quality selector is still an open v2 feature; see
  section 6 of `product-plan.md`.
- Structured data was added the same day: FAQPage, HowTo and WebApplication
  JSON-LD, generated from the same `FAQS` and `STEPS` constants the visible
  copy renders from, so the schema and the page cannot drift apart. There is
  deliberately no AggregateRating.

Still open:
- Page-level meta descriptions for FAQ, About, Terms, Privacy, Copyright, DMCA
  and Clip live only in the page files. They are documented per section here
  but only where captured.
