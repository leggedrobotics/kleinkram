FROM kleinkram-base AS development

WORKDIR /app/frontend

CMD ["pnpm", "start:dev"]


FROM node:22-slim AS build


RUN corepack enable && corepack prepare pnpm@latest --activate

ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL


WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r

RUN pnpm --filter @kleinkram/shared build
RUN pnpm --filter @kleinkram/validation build
RUN pnpm --filter @kleinkram/api-dto build
RUN pnpm --filter kleinkram-frontend build

FROM nginx:alpine AS production

COPY --from=build /app/frontend/dist/spa /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
