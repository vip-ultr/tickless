FROM node:24-alpine AS base
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
RUN mkdir -p /app/.git/objects /app/.git/refs/heads && \
    echo "ref: refs/heads/main" > /app/.git/HEAD && \
    printf "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n" > /app/.git/config && \
    touch /app/.git/objects/pack && \
    touch /app/.git/refs/heads/main

USER node

EXPOSE 9000
CMD [ "node", "src/cobalt" ]
