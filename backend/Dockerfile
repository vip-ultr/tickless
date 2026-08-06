FROM python:3.12-slim

# NOTE ON BUILD CONTEXT: this image is built from the REPO ROOT, not backend/,
# because it needs both backend/ and cobalt/ (see COBALT SIDECAR below).
# render.yaml sets dockerContext: . and dockerfilePath: backend/Dockerfile.

# ffmpeg needed for audio/slideshow handling.
# Node is REQUIRED twice over:
#   1. yt-dlp's YouTube signature/"n"-challenge solver (without it extraction
#      fails with "No video formats found" even with cookies), and
#   2. Cobalt itself, which we now run as a LOCAL SIDECAR in this same
#      container (see COBALT SIDECAR below).
#
# We install Node 22 from NodeSource rather than Debian's `nodejs` package.
# python:3.12-slim is bookworm, whose nodejs is 18.20.4: EOL, older than what
# Cobalt 11.x targets, and it does not reliably ship `corepack`, which the
# cobalt build below needs. Pinning the major here avoids a class of build
# breakage that would only show up on Render.
#
# We still deliberately do NOT install chromium. The PO-token provider is the
# Rust port (bgutil-ytdlp-pot-provider-rs), a single static binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg ca-certificates curl git gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && node --version \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt .
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

# ---------------------------------------------------------------------------
# COBALT SIDECAR
#
# Cobalt used to be a SEPARATE Render service. That could not work on the free
# tier: Render routes service-to-service traffic internally, straight to the
# spun-down container, which refuses the connection instantly instead of going
# through the public proxy that boots it. So the backend could never wake
# Cobalt, and Instagram only worked right after a manual redeploy. Measured:
# backend -> cold Cobalt failed in 13s (instant refusals), while the identical
# request from OUTSIDE Render woke it in ~15s and succeeded.
#
# Running Cobalt in THIS container removes the problem by construction: there
# is no second service to be asleep. One process group, one cold start, and
# the backend reaches Cobalt over 127.0.0.1, which is always up when we are.
# Measured combined footprint: ~213-231MB peak of the 512MB free tier.
# ---------------------------------------------------------------------------
COPY cobalt /cobalt-build
RUN cd /cobalt-build \
    # Install pnpm directly rather than via `corepack enable`. corepack's
    # signature verification has broken builds before and needs network trust
    # at build time; a pinned npm install is boring and deterministic. The
    # version MUST match cobalt/package.json's packageManager field.
    && npm install -g pnpm@9.6.0 \
    && pnpm --version \
    && pnpm install --prod --frozen-lockfile \
    && pnpm deploy --filter=@imput/cobalt-api --prod /cobalt-api \
    # Cobalt's version-info reads git metadata at startup; the build context
    # excludes .git, so create a minimal valid repo to keep it happy.
    && cd /cobalt-api \
    && git init -q \
    && git config user.email "ci@example.com" \
    && git config user.name "CI" \
    && git add -A \
    && git commit -qm "chore: cobalt deploy snapshot" \
    && git remote add origin https://github.com/imputnet/cobalt.git \
    # Drop the build tree and pnpm store; only /cobalt-api is needed at runtime.
    && rm -rf /cobalt-build /root/.cache/pnpm /root/.local/share/pnpm /pnpm

COPY backend/ .

ENV PORT=8000
ENV POT_PROVIDER_URL=http://127.0.0.1:4416
# The backend talks to the sidecar over loopback. Cobalt needs API_URL to match
# the address it serves tunnels on, or tunnel links come back malformed.
ENV COBALT_PORT=9000
ENV COBALT_URL=http://127.0.0.1:9000
ENV API_URL=http://127.0.0.1:9000/
EXPOSE 8000

RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
