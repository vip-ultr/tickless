# Tickless backend

FastAPI + yt-dlp service that extracts clean (no-watermark) TikTok video URLs.

## Endpoints
- `GET  /api/health` - liveness + yt-dlp version
- `GET  /api/health/extract` - deep check, runs a real extraction (used by daily cron)
- `POST /api/extract` - body `{"url": "..."}`, header `X-Tickless-Key`, rate limited 10/min/IP

## Local dev
```bash
uv venv && . .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env   # fill values (API key optional locally)
uvicorn main:app --reload
```

### ExifTool (required by `POST /api/clean`)

`cleaner.exiftool_path()` is `shutil.which("exiftool")`, called at **request**
time rather than at import. A missing binary therefore does not stop the server:
the route returns `500`, and `test_clean.py` skips (`HAS_EXIFTOOL`).

- Docker / Render: installed by the `Dockerfile` (`libimage-exiftool-perl`).
- Local, with sudo: `sudo apt install libimage-exiftool-perl`.
- Local, no sudo: clone `https://github.com/exiftool/exiftool` and symlink the
  `exiftool` script into `~/.local/bin`.

`~/.local/bin` is put on `PATH` by `~/.bashrc` (interactive shells, line 120)
and by `~/.profile` (login shells), so any normal terminal already finds it.
**Non-interactive** shells skip both: `.bashrc` returns at its `case $- in *i*)`
guard before reaching that line. That covers `bash -c`, `wsl -- <cmd>`, VS Code
tasks and debugger launches. Prefix the command in those cases:

```bash
PATH="$HOME/.local/bin:$PATH" uvicorn main:app --reload
```

Confirm before trusting it: `command -v exiftool && curl -s localhost:8000/api/health`.

## Tests
```bash
python -m pytest -q          # all
python -m pytest -m live -q  # live extraction only
```

## Health check (for cron)
```bash
python healthcheck.py https://your-backend.onrender.com
```

## Deploy (Render)
- Docker deploy using the included `Dockerfile` (installs ffmpeg, auto-updates yt-dlp on build and boot).
- Set env vars from `.env.example` in the Render dashboard.
- Free tier spins down after 15 min idle (~60s cold start) - the frontend shows a "waking up" state.

## Notes
- Design returns the TikTok CDN URL directly (redirect, not proxy) to keep bandwidth near zero on the free tier.
- yt-dlp breaks periodically when TikTok changes; the Dockerfile auto-updates it and the daily health check alerts us.
redeploy probe 20260728214116
redeploy probe 20260728214334
