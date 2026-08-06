<div align="center">

# Tickless

### Clean, watermark-free TikTok and Instagram downloads. No app, no sign-up, no account.

**Built by [Optivis Labs](https://optivislabs.vercel.app)** · Not affiliated with TikTok, ByteDance, Instagram, or Meta.

[Web app](https://tickless.vercel.app) · [Legal posture](./docs/legal-posture.md)

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Frontend: Next.js](https://img.shields.io/badge/frontend-Next.js-black)
![Backend: FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)
![No paid APIs](https://img.shields.io/badge/no%20paid%20APIs-ok-brightgreen)

</div>

---

## What it does

Paste a TikTok or Instagram link, pick your quality, and the clean file lands on your
device. No watermark, no re-recording, no quality loss.

- **No watermark.** You get the same clean file the platform serves inside its own app, not a re-recorded copy.
- **Actually free.** No trial, no card, no hidden export fee.
- **Nothing to install.** It runs in your browser on your phone, tablet, or computer.
- **We keep nothing.** No accounts, no download history, no copies stored on our side.
- **Audio too.** Grab just the sound as an MP3 when that is all you need.

## How it works

1. **Copy the link.** In TikTok or Instagram, tap Share, then Copy link.
2. **Paste it here.** Drop the link in the box and hit Download.
3. **Save the clean file.** Pick HD, standard, or audio, and it saves straight to your device.

## Why it exists

Saving a TikTok or Reel usually means a watermark stamped on the file, or handing your
link to a pop-up-covered site. Tickless does one thing well: it returns the clean file
and asks for nothing in return. Built by an independent studio, designed to grow, and
engineered for reliability rather than tricks.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, framer-motion |
| Frontend hosting | Vercel |
| Backend | FastAPI + yt-dlp + ffmpeg, containerized |
| Backend hosting | Render |
| Instagram | Self-hosted Cobalt instance on Render |
| Ads storage | Supabase (Postgres + object storage) |
| Analytics | Cookieless, aggregated, daily-salted hashing (no raw IPs) |
| Monitoring | Daily health-check cron that catches extraction breakage early |

There are **no paid APIs**. yt-dlp does the extraction and the architecture returns the
platform CDN URL (or streams the file) so the backend only performs light extraction
work. That keeps the free hosting tiers comfortably within their limits.

## Architecture

Cobalt runs as a **sidecar inside the backend container**, not as a separate
service. On Render's free tier a second service could not work: Render routes
service-to-service traffic internally, straight to the spun-down container,
which refuses the connection instantly instead of going through the public
proxy that boots it. The backend therefore could never wake Cobalt, and
Instagram only worked for ~15 minutes after a manual redeploy. Co-locating
them removes that failure mode: there is no second service left to be asleep.

```
 Browser          Vercel (Next.js)              Render (one container)
   user   ---fetch--->   frontend    ---POST /api/extract--->   backend
                                                        |
                                                        +-- yt-dlp    (TikTok)
                                                        +-- Cobalt    (Instagram)
                                                          |   via 127.0.0.1:9000
                                                          v
                                              TikTok / Instagram CDN
                                                   clean media -> device
```

## Project structure

```
tickless/
  frontend/   Next.js app (deploys to Vercel)
  backend/    FastAPI service + Cobalt sidecar (deploys to Render)
    backend/cobalt/  Cobalt source, built into the image
  docs/       Product plan and legal posture
```

## Quick start

### Backend

```bash
cd backend
uv venv && . .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env        # fill values (API key optional locally)
uvicorn main:app --reload   # http://127.0.0.1:8000
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev                    # http://localhost:3000
```

Point the frontend at your backend with `NEXT_PUBLIC_API_URL`.

### Cobalt (Instagram)

Built into the backend image from `backend/cobalt/` and started as a loopback sidecar
by `backend/start.sh`; it is not a separate Render service. The backend
reaches it at `COBALT_URL` (`http://127.0.0.1:9000` in production).

To run it locally alongside the backend:

```bash
cd backend/cobalt && pnpm install --prod --frozen-lockfile
cd api && API_URL=http://127.0.0.1:9000/ PORT=9000 node src/cobalt
# then start the backend with COBALT_URL=http://127.0.0.1:9000
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/health/extract` | Deep check: runs a real yt-dlp extraction |
| `GET` | `/api/health/cobalt` | Cobalt sidecar liveness (Instagram path) |
| `POST` | `/api/extract` | Extract clean media (auth + rate limited) |
| `GET` | `/api/download` | Stream the clean file to the browser |

## Legal

Tickless helps users retrieve publicly available media and does not host any content.
Use is subject to the source platform's terms. We provide a [DMCA and takedown
process](https://tickless.vercel.app/dmca), a precise [privacy
policy](https://tickless.vercel.app/privacy), and [terms of
use](https://tickless.vercel.app/terms). The founder-level [legal
posture](./docs/legal-posture.md) explains how we think about risk.

## Status

Actively developed. TikTok and Instagram downloads are live. Photo-carousel to video,
more platforms, and richer quality options are on the roadmap.

## License

Released under the [MIT License](./LICENSE).
