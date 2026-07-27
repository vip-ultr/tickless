#!/usr/bin/env python3
"""Daily health check for the Tickless backend.

Pings the deep-extract endpoint with a known-good TikTok link. If extraction
is broken (yt-dlp outdated / TikTok changed), exits non-zero and prints an
alert so a cron job can notify us before users complain.

Usage:
    python healthcheck.py https://tickless-backend.onrender.com
"""
import sys
import urllib.request
import json


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    url = base.rstrip("/") + "/api/health/extract"
    try:
        with urllib.request.urlopen(url, timeout=90) as r:
            data = json.loads(r.read())
        if data.get("status") == "ok" and data.get("has_video"):
            print("OK: extraction working")
            return 0
        print(f"BROKEN: {data}")
        return 1
    except Exception as e:
        # 503 from the endpoint also lands here via HTTPError
        print(f"ALERT: Tickless extraction health check failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
