FROM kleinkram-base AS development

WORKDIR /app/frontend

CMD ["pnpm", "start:dev"]


FROM node:22-slim AS build


RUN corepack enable && corepack prepare pnpm@latest --activate

ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

ARG GIT_BRANCH
ENV GIT_BRANCH=$GIT_BRANCH

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

ARG VITE_S3_ENDPOINT
ENV VITE_S3_ENDPOINT=$VITE_S3_ENDPOINT

WORKDIR /app

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install -r

# Generate build info explicitly to ensure it captures build-time ARGs
WORKDIR /app/frontend
RUN sh ./create_build_info.sh
WORKDIR /app

RUN pnpm --filter @kleinkram/shared build
RUN pnpm --filter @kleinkram/validation build
RUN pnpm --filter @kleinkram/api-dto build
RUN pnpm --filter kleinkram-frontend build

FROM debian:bookworm-slim AS nginx-base
RUN apt-get update && \
    apt-get install -y nginx && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /etc/nginx/sites-enabled/default

# Configure nginx for non-root execution
RUN sed -i 's/user www-data;//g' /etc/nginx/nginx.conf && \
    sed -i 's/pid \/run\/nginx.pid;/pid \/tmp\/nginx.pid;/g' /etc/nginx/nginx.conf && \
    # Forward logs to stdout/stderr
    ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log && \
    # Create temp directory for nginx runtime files corresponding to default config
    mkdir -p /var/lib/nginx/body /var/lib/nginx/fastcgi /var/lib/nginx/proxy /var/lib/nginx/scgi /var/lib/nginx/uwsgi && \
    chmod -R 777 /var/lib/nginx /var/log/nginx


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

COPY --from=build /app/frontend/dist/spa /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

USER 65532:65532

ENTRYPOINT ["/usr/sbin/nginx", "-g", "daemon off;"]
