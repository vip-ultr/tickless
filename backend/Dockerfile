FROM python:3.12-slim

# ffmpeg needed for audio/slideshow handling
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Always pull the latest yt-dlp at build time (TikTok breaks the old one).
RUN pip install --no-cache-dir --upgrade yt-dlp

COPY . .

ENV PORT=8000
EXPOSE 8000

# Upgrade yt-dlp again on container start, then launch.
CMD pip install --no-cache-dir --upgrade yt-dlp >/dev/null 2>&1; \
    uvicorn main:app --host 0.0.0.0 --port ${PORT}
