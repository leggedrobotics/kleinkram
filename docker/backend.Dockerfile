FROM kleinkram-base AS development

# Install runtime dependencies for Python (rosbags)
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install rosbags --break-system-packages --no-cache-dir
USER node

WORKDIR /app/backend

CMD ["./entrypoint.sh"]


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
RUN NODE_ENV=production pnpm --filter kleinkram-backend build
RUN pnpm deploy --filter=kleinkram-backend --prod --legacy /prod/backend

FROM gcr.io/distroless/nodejs22-debian12 AS production

WORKDIR /app

COPY --from=build /app/backend/dist/main.js ./backend/dist/main.js
COPY --from=build /app/backend/package.json ./backend/package.json

WORKDIR /app/backend

CMD ["dist/main.js"]
