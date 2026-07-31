FROM python:3.12-slim

# ffmpeg needed for audio/slideshow handling.
# nodejs is REQUIRED by yt-dlp's YouTube signature/"n"-challenge solver;
# without it, extraction fails with "No video formats found" even with cookies.
# NOTE: we deliberately do NOT install chromium/npm. The PO-token provider below
# is the Rust port (bgutil-ytdlp-pot-provider-rs) — a single static binary that
# runs YouTube's BotGuard in Rust. No Chrome, no Node, no npm needed.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Always pull the latest yt-dlp at build time (TikTok breaks the old one).
RUN pip install --no-cache-dir --upgrade yt-dlp

# PO-token provider (cookie-less YouTube bot-wall defeat).
#   - Python plugin (bgutil-ytdlp-pot-provider) registers with yt-dlp's POT
#     framework so yt-dlp auto-requests a token for the web/web_safari clients.
#   - Rust provider binary (bgutil-pot-linux-x86_64) is the token *backend*; it
#     implements BotGuard natively (no Chrome/Node). We run it as a local HTTP
#     server on 127.0.0.1:4416 and point the plugin at it via extractor_args.
RUN pip install --no-cache-dir bgutil-ytdlp-pot-provider \
    && curl -fsSL -o /usr/local/bin/bgutil-pot \
        "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/v0.8.1/bgutil-pot-linux-x86_64" \
    && chmod +x /usr/local/bin/bgutil-pot

COPY . .

ENV PORT=8000
ENV POT_PROVIDER_URL=http://127.0.0.1:4416
EXPOSE 8000

# Start the Rust PO-token provider as a local HTTP server in the background,
# then launch the API. Ensure node is on PATH for yt-dlp's signature solver.
CMD export PATH="$PATH:/usr/bin:/usr/local/bin" \
    && /usr/local/bin/bgutil-pot --port 4416 --address 127.0.0.1 >/tmp/pot.log 2>&1 & \
    pip install --no-cache-dir --upgrade yt-dlp >/dev/null 2>&1; \
    uvicorn main:app --host 0.0.0.0 --port ${PORT}
