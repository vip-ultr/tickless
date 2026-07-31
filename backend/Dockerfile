FROM python:3.12-slim

# ffmpeg needed for audio/slideshow handling.
# nodejs is REQUIRED by yt-dlp's YouTube signature/"n"-challenge solver;
# without it, extraction fails with "No video formats found" even with cookies.
# chromium is REQUIRED by the PO-token provider (bgutil-ytdlp-pot-provider),
# which beats YouTube's bot wall WITHOUT account cookies (datacenter IP safe).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Always pull the latest yt-dlp at build time (TikTok breaks the old one).
RUN pip install --no-cache-dir --upgrade yt-dlp

# PO-token provider: lets yt-dlp solve YouTube's Proof-of-Origin challenge via
# headless Chromium, defeating the "confirm you're not a bot" wall with no
# account cookies. Both the Python plugin and its bundled Node server are needed.
RUN pip install --no-cache-dir bgutil-ytdlp-pot-provider \
    && npm install -g bgutil-ytdlp-pot-provider

COPY . .

ENV PORT=8000
EXPOSE 8000

# Upgrade yt-dlp again on container start, then launch. Ensure node + chromium
# are on PATH (yt-dlp's signature solver execs `node`; PO provider execs `chromium`).
CMD export PATH="$PATH:/usr/bin:/usr/local/bin"; \
    pip install --no-cache-dir --upgrade yt-dlp >/dev/null 2>&1; \
    uvicorn main:app --host 0.0.0.0 --port ${PORT}
