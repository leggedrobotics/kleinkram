FROM kleinkram-base AS development

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

WORKDIR /app

COPY --from=build /prod/queueConsumer ./queueConsumer
COPY --from=build /app/queueConsumer/dist ./queueConsumer/dist
COPY --from=build /app/queueConsumer/entrypoint.sh ./queueConsumer/entrypoint.sh

WORKDIR /app/queueConsumer

CMD ["./entrypoint.sh"]
