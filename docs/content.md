# Tickless — Website Content & Copy (LOCKED)

> **Status:** LOCKED content source of truth. Every word that appears on the Tickless website is written here first. The build MUST use this copy verbatim. No improvised marketing copy during implementation.
>
> **Copy rules (enforced):** No em-dashes (—). No AI-filler phrases ("empower", "seamlessly", "unlock", "elevate", "in today's fast-paced world"). Plain, specific, confident. Quantities as digits. Human voice.

---

## 0. Global

- **Product name:** Tickless
- **Tagline (primary):** TikTok videos, no watermark, no fuss.
- **Tagline (alt / OG):** Paste a link. Get the clean video. Done.
- **Meta description:** Tickless downloads TikTok videos without the watermark in HD, straight to your device. Free, fast, no app, no sign-up.
- **Domain (for now):** tickless.vercel.app

---

## 1. Navigation

Links (desktop bar + mobile bottom sheet):
- Home
- FAQ
- About

Footer legal links:
- Terms
- Privacy
- Copyright / DMCA

CTA button label (nav): "Paste a link"

---

## 2. Home page

### Hero
- **Eyebrow:** Free TikTok downloader
- **Headline:** Save any TikTok without the watermark.
- **Subhead:** Paste the link, pick your quality, and the clean video lands on your device in seconds. No app to install, no account to make.
- **Input placeholder:** Paste your TikTok link here
- **Primary button:** Download
- **Paste button (small):** Paste
- **Microtrust line under input:** Works with tiktok.com, vm.tiktok.com and short links.

### Result card (after extract)
- Labels: "HD video", "Standard", "Audio only (MP3)"
- Download button: "Download"
- Secondary: "Download another"
- Meta shown: creator handle, video title, duration.

### Loading / states copy
- Extracting: "Reading the video..." (with skeleton placeholders)
- Server waking (Render cold start): "Waking up the server, this takes a few seconds on the first request."
- Slideshow teaser (photo post detected): "This is a photo slideshow. Slideshow to video is coming soon. Video posts work right now."
- Error, bad link: "That does not look like a TikTok link. Check it and try again."
- Error, private/removed: "We could not reach this video. It may be private, removed, or region locked."
- Error, generic: "Something went wrong on our side. Give it another try in a moment."

### How it works (3 steps)
1. **Copy the link.** In TikTok, tap Share, then Copy link.
2. **Paste it here.** Drop the link in the box above and hit Download.
3. **Save the clean file.** Pick HD, standard, or audio, and it saves straight to your device.

### Why Tickless (features, real copy, no filler)
- **No watermark.** You get the same clean file TikTok serves inside its own app, not a re-recorded copy.
- **Real HD.** When a high-resolution version exists, that is what you get. No quality loss.
- **Nothing to install.** It runs in your browser on your phone, tablet, or computer.
- **We keep nothing.** No accounts, no download history, no copies stored on our side.
- **Actually free.** No trial, no card, no hidden export fee. Ads keep the lights on later, that is it.
- **Audio too.** Grab just the sound as an MP3 when that is all you need.

### Closing band
- **Heading:** One box. Any TikTok video.
- **Text:** Paste a link above and see for yourself.

---

## 3. FAQ page

- **Heading:** Questions, answered.

Q: Is Tickless free?
A: Yes. There is no charge, no trial, and no card required. If ads appear later they are only there to cover server costs.

Q: Do I need an account or an app?
A: No. Tickless runs in your browser. There is nothing to sign up for and nothing to install.

Q: How does the no-watermark part work?
A: TikTok stores a clean version of every video on its own servers, which is the copy its app plays. Tickless fetches that clean version for you. Nothing is edited or re-recorded, so quality stays intact.

Q: What links are supported?
A: Full links like tiktok.com/@user/video/123, short links like vm.tiktok.com/xxxx, and links copied straight from the Share menu.

Q: Can I download the audio only?
A: Yes. When a video is ready you can choose to save just the audio as an MP3.

Q: Do you store the videos I download?
A: No. Tickless does not keep the videos or a record of what you download. The file goes from TikTok to your device.

Q: Why is the first download sometimes slow?
A: On the free server plan the backend sleeps after a quiet period and takes a few seconds to wake up. After that first request it is fast.

Q: Can I download photo slideshows?
A: Not yet. Video posts work now. Turning photo slideshows into a video is on the way.

Q: Is this legal?
A: Tickless is a tool. Download content you own or have permission to use, and respect the rights of creators. See the Copyright page for details.

---

## 4. About page

- **Heading:** About Tickless

Body:
Tickless started with a simple annoyance: saving a TikTok meant getting a video stamped with a watermark, or handing your link to a sketchy site covered in pop-ups. We wanted the clean file and nothing else.

So Tickless does one thing and does it well. You paste a link, you get the video the way it was meant to look, and we do not ask for your email or keep a log of what you saved.

It is built to grow. TikTok is the first platform. Support for more is planned under the same roof, so one tool covers the places you actually post and watch.

- **Sub-heading:** Who builds this
Tickless is built by Optivis Labs, an independent software studio that ships real products, not demos.

---

## 5. Footer

- Wordmark: Tickless
- Short line: The clean way to save TikTok videos.
- Columns:
  - Product: Home, FAQ
  - Company: About
  - Legal: Terms, Privacy, Copyright
- Bottom line: (c) 2026 Tickless by Optivis Labs. Not affiliated with TikTok or ByteDance.

---

## 6. Legal pages (plain-language, real)

### Terms (summary copy)
- **Heading:** Terms of Use
- Tickless is provided as is, for personal use. You are responsible for what you download and for having the right to use it. Do not use Tickless to break the law or infringe on other people's work. We may change or pause the service at any time.

### Privacy (summary copy)
- **Heading:** Privacy
- Tickless does not require an account and does not store the videos you download or a history of your activity. We do not sell data. Basic, anonymous traffic stats may be used to keep the service running. Links you paste are used only to fetch that video and are not retained.

### Copyright / DMCA (summary copy)
- **Heading:** Copyright
- Tickless does not host any videos. All content stays on TikTok's servers. Download only content you own or are permitted to use. If you believe your rights are affected, contact us and we will respond.

---

## 7. Small UI strings (buttons, toasts, a11y)

- Copy success toast: "Link pasted."
- Download started toast: "Your download is starting."
- Copied-to-clipboard toast: "Copied."
- Nav open (mobile) button aria-label: "Open menu"
- Nav close button aria-label: "Close menu"
- Input aria-label: "TikTok video link"
- 404 heading: "This page took a walk."
- 404 body: "The link is broken or the page moved. Head back home and try again."
- 404 button: "Back to home"

---

## 8. Social / launch copy (for reserved handles)

- **Bio (X/IG):** Save TikTok videos without the watermark. Free, no app, no sign-up. Built by Optivis Labs.
- **Pinned/launch post:** Tickless is live. Paste a TikTok link, get the clean video in HD, no watermark and no account. Free to use. [link]
