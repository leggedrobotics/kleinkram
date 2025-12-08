FROM kleinkram-base AS development

USER root
RUN apt-get update && apt-get install -y curl && \
    curl -sL "https://github.com/google/go-containerregistry/releases/download/v0.19.1/go-containerregistry_Linux_x86_64.tar.gz" > crane.tar.gz && \
    tar -zxvf crane.tar.gz -C /usr/local/bin/ crane && \
    rm crane.tar.gz && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
USER node

WORKDIR /app/queueConsumer

CMD ["pnpm", "start:dev"]


FROM node:22-slim AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r

RUN pnpm --filter @kleinkram/shared build
RUN pnpm --filter @kleinkram/validation build
RUN pnpm --filter @kleinkram/api-dto build
RUN pnpm --filter @kleinkram/backend-common build
RUN pnpm --filter kleinkram-queue-consumer build
RUN pnpm deploy --filter=kleinkram-queue-consumer --prod --legacy /prod/queueConsumer

FROM node:22-slim AS production

RUN apt-get update && apt-get install -y curl && \
    curl -sL "https://github.com/google/go-containerregistry/releases/download/v0.19.1/go-containerregistry_Linux_x86_64.tar.gz" > crane.tar.gz && \
    tar -zxvf crane.tar.gz -C /usr/local/bin/ crane && \
    rm crane.tar.gz && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /prod/queueConsumer ./queueConsumer
COPY --from=build /app/queueConsumer/dist ./queueConsumer/dist
COPY --from=build /app/queueConsumer/entrypoint.sh ./queueConsumer/entrypoint.sh

WORKDIR /app/queueConsumer

CMD ["./entrypoint.sh"]
