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
# Instagram rate-limits self-hosted Cobalt by server IP. To beat that, route
# Cobalt's OUTBOUND Instagram fetches through a proxy. We scope the proxy to the
# Cobalt sidecar ONLY (via COBALT_HTTP_PROXY / COBALT_HTTPS_PROXY on the Render
# service) and keep loopback out of it (NO_PROXY), so the backend's own
# loopback Cobalt call, yt-dlp (TikTok/YouTube), and YouTube PO-token provider
# are never proxied. Left empty = direct connection (current behaviour; IG may
# rate-limit). Cobalt honours these via undici's EnvHttpProxyAgent.
COBALT_HTTP_PROXY="${COBALT_HTTP_PROXY:-}"
COBALT_HTTPS_PROXY="${COBALT_HTTPS_PROXY:-${COBALT_HTTP_PROXY}}"
if [ -n "$COBALT_HTTP_PROXY" ] || [ -n "$COBALT_HTTPS_PROXY" ]; then
    echo "[start] Cobalt outbound proxy ENABLED (IG fetches routed via proxy)"
    # Fail loudly if the proxy is configured but unreachable, instead of serving
    # silent IG no_media errors. Parse host:port and probe it (TCP, 5s).
    PROXY_HOST=$(printf '%s' "${COBALT_HTTPS_PROXY:-$COBALT_HTTP_PROXY}" | sed -E 's#^[a-zA-Z0-9]+://##; s#/.*$##; s#^[^@]*@##; s#:[0-9]+$##')
    PROXY_PORT=$(printf '%s' "${COBALT_HTTPS_PROXY:-$COBALT_HTTP_PROXY}" | sed -E 's#^[a-zA-Z0-9]+://##; s#/.*$##; s#^[^@]*@##; s#^[^:]+:##; s#[^0-9]##g')
    PROXY_PORT="${PROXY_PORT:-3128}"
    if command -v nc >/dev/null 2>&1; then
        if ! nc -z -w 5 "$PROXY_HOST" "$PROXY_PORT" 2>/dev/null; then
            echo "[start] FATAL: COBALT proxy $PROXY_HOST:$PROXY_PORT is unreachable" >&2
            exit 1
        fi
        echo "[start] proxy reachability check passed ($PROXY_HOST:$PROXY_PORT)"
    else
        echo "[start] WARNING: nc not available; skipping proxy reachability check"
    fi
else
    echo "[start] Cobalt outbound proxy DISABLED (direct connection; IG may rate-limit)"
fi
API_URL="${API_URL:-http://127.0.0.1:9000/}" \
PORT="${COBALT_PORT:-9000}" \
HTTP_PROXY="$COBALT_HTTP_PROXY" \
HTTPS_PROXY="$COBALT_HTTPS_PROXY" \
NO_PROXY="127.0.0.1,localhost" \
    node src/cobalt 2>&1 | sed 's/^/[cobalt] /' &
COBALT_PID=$!

cd /app

# The backend MUST reach the sidecar over loopback. Force these regardless of
# any stale dashboard value (e.g. the old https://tickless-cobalt.onrender.com
# from when Cobalt was a separate service). A wrong COBALT_URL here is exactly
# what produced 503s after the merge: the sidecar is up on 127.0.0.1:9000 but
# the backend probes the dead external URL. Exporting the correct value makes
# the container self-correct even if the dashboard env var is stale.
export COBALT_PORT="${COBALT_PORT:-9000}"
export COBALT_URL="http://127.0.0.1:${COBALT_PORT}"
export API_URL="http://127.0.0.1:${COBALT_PORT}/"

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

# If a proxy is configured, verify it actually gives Cobalt a working route to
# Instagram end-to-end (not just TCP-open). A dead-but-listening proxy, or an
# IG-blocked proxy IP, would otherwise surface as silent no_media errors for
# users. We ask Cobalt itself (it already carries the proxy env) to extract a
# KNOWN-LIVE public post; a media response proves the proxy works. This block
# only runs in proxy mode, so direct connections and all other features are
# unaffected. Post-specific errors (deleted/private) warn but don't fail boot.
if [ -n "$COBALT_HTTP_PROXY" ] || [ -n "$COBALT_HTTPS_PROXY" ]; then
    CANARY="https://www.instagram.com/p/DcYOY-yDP_U/?img_index=1"
    echo "[start] proxy self-test: extracting a known public IG post through the proxy..."
    PROBE=$(curl -s -m 40 -X POST "http://127.0.0.1:${COBALT_PORT:-9000}/" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$CANARY\",\"downloadMode\":\"auto\",\"videoQuality\":\"1080\"}" 2>/dev/null || true)
    STATUS=$(printf '%s' "$PROBE" | python3 -c "import sys,json; \
        try: print(json.load(sys.stdin).get('status','?')) \
        except Exception: print('parse-error')" 2>/dev/null || echo "parse-error")
    ERRCODE=$(printf '%s' "$PROBE" | python3 -c "import sys,json; \
        try:
            d=json.load(sys.stdin); e=d.get('error') or {}; \
            print(e.get('code','') if isinstance(e,dict) else '') \
        except Exception: print('')" 2>/dev/null || true)
    case "$STATUS" in
        redirect|picker|tunnel|local-processing)
            echo "[start] proxy self-test PASSED (IG reachable through proxy: $STATUS)" ;;
        error)
            # Post-specific errors mean the proxy likely works but this canary
            # post is gone/private; don't fail boot over a stale test post.
            case "$ERRCODE" in
                post-not-found|cobalt.post-not-found|content.post.private|content.post.age|content.post.unavailable)
                    echo "[start] WARNING: proxy self-test hit a post-specific error ($ERRCODE); IG may still be reachable. Continuing." ;;
                *)
                    echo "[start] FATAL: proxy self-test failed: IG unreachable through proxy (status=error, code=${ERRCODE:-unknown})" >&2
                    exit 1 ;;
            esac ;;
        *)
            echo "[start] FATAL: proxy self-test inconclusive (status=$STATUS); proxy likely not routing to IG" >&2
            exit 1 ;;
    esac
fi

# 3. The API. Runs in the foreground as PID 1's child so Render tracks it.
pip install --no-cache-dir --upgrade yt-dlp >/dev/null 2>&1 || true
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
