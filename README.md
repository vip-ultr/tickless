<div align="center">

# Tickless

### Clean, watermark-free TikTok and Instagram downloads. No app, no sign-up, no account.

Built by **Optivis Labs**

[Web app](https://tickless.vercel.app) · [Optivis Labs](https://optivislabs.vercel.app)

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

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, framer-motion |
| Hosting (FE) | Vercel |
| Backend | FastAPI + yt-dlp + ffmpeg, containerized |
| Hosting (BE) | Render |
| Instagram | Self-hosted Cobalt instance on Render |
| Ads storage | Supabase (Postgres + object storage) |
| Monitoring | Health-check cron, cookieless analytics |

There are **no paid APIs**. yt-dlp does the extraction, and the architecture returns the
platform CDN URL (or streams the file) so the backend only does the light extraction work.
That keeps the free hosting tiers comfortably within their limits.

## Architecture

```
 Browser          Vercel (Next.js)              Render (FastAPI)
   user   ---fetch--->   frontend    ---POST /api/extract--->   backend
                                                        |
                                                        +-- yt-dlp    (TikTok)
                                                        +-- Cobalt    (Instagram)
                                                          |
                                                          v
                                              TikTok / Instagram CDN
                                                   clean media -> device
```

## Project structure

```
tickless/
  frontend/   Next.js app (deploys to Vercel)
  backend/    FastAPI service (deploys to Render)
  cobalt/     Self-hosted Cobalt instance (deploys to Render)
  docs/       Product plan and locked site copy
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

## Status

Actively developed. TikTok and Instagram downloads are live. Photo-carousel to video,
more platforms, and richer quality options are on the roadmap.

## License

Released under the [MIT License](./LICENSE).
