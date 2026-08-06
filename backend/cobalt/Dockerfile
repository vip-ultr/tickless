FROM node:24-alpine AS base
RUN apk add --no-cache git
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS build
WORKDIR /app
COPY . /app

RUN corepack enable
RUN apk add --no-cache python3 alpine-sdk

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

RUN pnpm deploy --filter=@imput/cobalt-api --prod /prod/api

FROM base AS api
WORKDIR /app

COPY --from=build --chown=node:node /prod/api /app
RUN if [ -d /app/.git ]; then cp -r /app/.git /app/.git; fi
# Cobalt's version-info reads git metadata at startup.
# Render's Docker build context excludes .git via .dockerignore,
# so create a minimal valid repo here.
RUN cd /app && \
    git init && \
    git config user.email "ci@example.com" && \
    git config user.name "CI" && \
    git add -A && \
    git commit -m "chore: cobalt deploy snapshot" && \
    git remote remove origin >/dev/null 2>&1 || true && \
    git remote add origin https://github.com/imputnet/cobalt.git

USER node

EXPOSE 9000
CMD [ "node", "src/cobalt" ]
