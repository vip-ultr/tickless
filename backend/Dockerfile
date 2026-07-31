FROM python:3.12-slim

# ffmpeg needed for audio/slideshow handling.
# nodejs is REQUIRED by yt-dlp's YouTube signature/"n"-challenge solver;
# without it, extraction fails with "No video formats found" even with cookies.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Always pull the latest yt-dlp at build time (TikTok breaks the old one).
RUN pip install --no-cache-dir --upgrade yt-dlp

COPY . .

ENV PORT=8000
EXPOSE 8000

# Upgrade yt-dlp again on container start, then launch. Ensure node is on PATH
# (Debian installs it at /usr/bin/node, but make it explicit for yt-dlp's
# signature solver which execs `node`).
CMD export PATH="$PATH:/usr/bin"; \
    pip install --no-cache-dir --upgrade yt-dlp >/dev/null 2>&1; \
    uvicorn main:app --host 0.0.0.0 --port ${PORT}
