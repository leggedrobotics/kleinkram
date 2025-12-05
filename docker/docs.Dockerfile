FROM node:22-alpine AS base

WORKDIR /app

# Copy package.json from docs folder
COPY docs/package.json docs/pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Development Stage
FROM base AS development
CMD ["npm", "run", "docs:dev", "/app/src"]

# Builder Stage
FROM base AS builder
ARG MODE="production"

# Copy all docs source
COPY docs ./

# Build the docs
RUN pnpm run docs:build:${MODE}

# Production Stage
FROM nginx:1.23.2-alpine AS production

# Copy the built docs
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# Copy the nginx config
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf

# Start the nginx server
CMD ["nginx", "-g", "daemon off;"]
