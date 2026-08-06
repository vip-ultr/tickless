#!/bin/sh
# Start the three processes that make up the Tickless backend container:
#
#   1. bgutil-pot   (127.0.0.1:4416) - YouTube PO-token provider
#   2. cobalt       (127.0.0.1:9000) - Instagram/TikTok extractor SIDECAR
#   3. uvicorn      (0.0.0.0:$PORT)  - the API itself, the only public port
#
# Cobalt runs HERE rather than as a second Render service on purpose: on the
# free tier the backend could never wake a separate spun-down Cobalt, because
# Render routes service-to-service traffic internally and the stopped
# container refuses the connection instantly instead of booting. Co-locating
# removes that failure mode entirely.
set -e

export PATH="$PATH:/usr/bin:/usr/local/bin"

# 1. PO-token provider (YouTube bot-wall).
/usr/local/bin/bgutil-pot --port 4416 --address 127.0.0.1 >/tmp/pot.log 2>&1 &

# 2. Cobalt sidecar. Logs go to stdout so they show up in Render's log stream
#    (the old separate service only ever showed deploy logs, which is why
#    Cobalt failures were invisible).
cd /cobalt-api
API_URL="${API_URL:-http://127.0.0.1:9000/}" \
PORT="${COBALT_PORT:-9000}" \
    node src/cobalt 2>&1 | sed 's/^/[cobalt] /' &
COBALT_PID=$!

cd /app

# Wait for the sidecar to actually listen before accepting traffic, so the
# first user request never races the boot. Cobalt starts in ~1s locally; 30s
# is a generous ceiling.
echo "[start] waiting for cobalt sidecar..."
i=0
while [ "$i" -lt 60 ]; do
    if curl -fsS -m 2 "http://127.0.0.1:${COBALT_PORT:-9000}/" >/dev/null 2>&1; then
        echo "[start] cobalt sidecar is up after ${i}s"
        break
    fi
    # If the sidecar died, fail loudly instead of serving broken Instagram.
    if ! kill -0 "$COBALT_PID" 2>/dev/null; then
        echo "[start] FATAL: cobalt sidecar exited during startup" >&2
        exit 1
    fi
    i=$((i + 1))
    sleep 1
done

if [ "$i" -ge 60 ]; then
    echo "[start] FATAL: cobalt sidecar did not come up within 60s" >&2
    exit 1
fi

# 3. The API. Runs in the foreground as PID 1's child so Render tracks it.
pip install --no-cache-dir --upgrade yt-dlp >/dev/null 2>&1 || true
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
