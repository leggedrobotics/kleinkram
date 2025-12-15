FROM node:22-slim AS base

WORKDIR /app

# Copy package.json from docs folder
COPY docs/package.json docs/pnpm-lock.yaml tsconfig.base.json ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Development Stage
FROM base AS development
CMD ["npm", "run", "docs:dev", "/app/src"]

# Swagger Stage
FROM node:22-slim AS swagger-builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./

# Copy backend and packages manifests to install dependencies efficiently
COPY backend/package.json ./backend/
COPY packages/api-dto/package.json ./packages/api-dto/
COPY packages/backend-common/package.json ./packages/backend-common/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validation/package.json ./packages/validation/

# Install dependencies (including devDependencies for ts-node)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY backend ./backend
COPY packages ./packages

# Generate Swagger
WORKDIR /app/backend
RUN SERVER_PORT=3000 \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_USER=test \
    DB_PASSWORD=test \
    DB_DATABASE=test \
    DEV=false \
    ENTITIES="src/**/*.entity.ts" \
    REDIS_HOST=localhost \
    JWT_SECRET=secret \
    MINIO_ACCESS_KEY=test \
    MINIO_SECRET_KEY=test \
    MINIO_DATA_BUCKET_NAME=test \
    MINIO_DB_BUCKET_NAME=test \
    MINIO_ARTIFACTS_BUCKET_NAME=test \
    MINIO_ENDPOINT=localhost \
    MINIO_USER=test \
    MINIO_PASSWORD=test \
    FRONTEND_URL=http://localhost:8000 \
    BACKEND_URL=http://localhost:3000 \
    DOCS_URL=http://localhost:4000 \
    GOOGLE_KEY_FILE=test.json \
    ARTIFACTS_UPLOADER_IMAGE=test \
    VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT=true \
    node -r ts-node/register -r tsconfig-paths/register ./scripts/generate-openapi.ts

# Builder Stage
FROM base AS builder
ARG MODE="production"

# Copy all docs source
COPY docs ./src
RUN mkdir -p ./src/development/api/generated

# Copy generated markdown files
COPY --from=swagger-builder /app/backend/*.md ./src/development/api/generated/

# build postgres entity documentation
COPY packages/backend-common/src ./packages/backend-common/src

# Run the locally installed tsx binary directly to avoid pnpm exec lookup issues
RUN mkdir -p src/development/application-structure && \
    cd src && \
    ../node_modules/.bin/tsx scripts/generate-entity-documentation.ts && \
    test -f development/application-structure/postgres.md

# Build the docs
RUN pnpm run docs:build:${MODE} -- src

FROM debian:bookworm-slim AS nginx-base
RUN apt-get update && apt-get install -y nginx
RUN rm -rf /var/lib/apt/lists/*
RUN rm -rf /etc/nginx/sites-enabled/default

# Configure nginx for non-root execution
RUN sed -i 's/user www-data;//g' /etc/nginx/nginx.conf
RUN sed -i 's/pid \/run\/nginx.pid;/pid \/tmp\/nginx.pid;/g' /etc/nginx/nginx.conf
RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log
RUN mkdir -p /var/lib/nginx/body /var/lib/nginx/fastcgi /var/lib/nginx/proxy /var/lib/nginx/scgi /var/lib/nginx/uwsgi
RUN chmod -R 777 /var/lib/nginx /var/log/nginx

# Production Stage
FROM gcr.io/distroless/base-debian12 AS production

# Copy nginx binary and config
COPY --from=nginx-base /usr/sbin/nginx /usr/sbin/nginx
COPY --from=nginx-base /etc/nginx /etc/nginx
COPY --from=nginx-base /var/lib/nginx /var/lib/nginx
COPY --from=nginx-base /var/log/nginx /var/log/nginx

# Copy required shared libraries (identified via ldd on debian:bookworm-slim)
COPY --from=nginx-base /lib/x86_64-linux-gnu/libcrypt.so.1 /lib/x86_64-linux-gnu/libcrypt.so.1
COPY --from=nginx-base /lib/x86_64-linux-gnu/libpcre2-8.so.0 /lib/x86_64-linux-gnu/libpcre2-8.so.0
COPY --from=nginx-base /lib/x86_64-linux-gnu/libz.so.1 /lib/x86_64-linux-gnu/libz.so.1

# Copy the built docs
COPY --from=builder /app/src/.vitepress/dist /usr/share/nginx/html
COPY --from=swagger-builder /app/backend/swagger.json /usr/share/nginx/html/swagger.json
# Copy generated markdown files
COPY --from=swagger-builder /app/backend/*.md /usr/share/nginx/html/development/api/generated/
COPY --from=swagger-builder /app/backend/api-modules.json /usr/share/nginx/html/development/api/generated/api-modules.json

# Copy the nginx config
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf

USER 65532:65532

# Start the nginx server
ENTRYPOINT ["/usr/sbin/nginx", "-g", "daemon off;"]
