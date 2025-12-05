FROM kleinkram-base AS development

WORKDIR /app/backend

CMD ["pnpm", "start:dev"]


FROM node:22-slim AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r

# Build packages and backend
RUN pnpm --filter @kleinkram/shared build
RUN pnpm --filter @kleinkram/validation build
RUN pnpm --filter @kleinkram/api-dto build
RUN pnpm --filter @kleinkram/backend-common build
RUN pnpm --filter backend build

FROM node:22-slim AS production

WORKDIR /app

# Install runtime dependencies for Python (rosbags)
RUN apt-get update && apt-get install -y --no-install-recommends python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install rosbags --break-system-packages

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/entrypoint.sh ./backend/entrypoint.sh

WORKDIR /app/backend

CMD ["./entrypoint.sh"]
