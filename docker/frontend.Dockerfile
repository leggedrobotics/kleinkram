FROM node:22-slim AS development

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies using pnpm fetch
COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r --offline

# No pre-build needed - Vite resolves packages from source via aliases in quasar.config.ts

WORKDIR /app/frontend

CMD ["pnpm", "start:dev"]

FROM node:22-slim AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r --offline

RUN pnpm --filter @kleinkram/shared build
RUN pnpm --filter @kleinkram/validation build
RUN pnpm --filter @kleinkram/api-dto build
RUN pnpm --filter frontend build

FROM nginx:alpine AS production

COPY --from=build /app/frontend/dist/spa /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
