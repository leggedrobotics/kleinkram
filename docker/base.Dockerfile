FROM node:22-slim AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

ARG USER_ID=1000
ARG GROUP_ID=1000

RUN if [ ${USER_ID} -ne 1000 ]; then \
    deluser --remove-home node && \
    addgroup -g ${GROUP_ID} node && \
    adduser -u ${USER_ID} -G node -s /bin/sh -D node; \
    fi

WORKDIR /app

# Install dependencies using pnpm fetch for caching
COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r --offline

RUN chown node:node /app

USER node
