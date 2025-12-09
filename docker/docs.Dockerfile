FROM node:22-slim AS base

WORKDIR /app

# Copy package.json from docs folder
COPY docs/package.json docs/pnpm-lock.yaml tsconfig.base.json ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Development Stage
FROM base AS development
CMD ["npm", "run", "docs:dev", "/app/src"]

# Builder Stage
FROM base AS builder
ARG MODE="production"

# Copy all docs source
COPY docs ./src

# Build the docs
RUN pnpm run docs:build:${MODE} -- src

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

# Copy the nginx config
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf

USER 65532:65532

# Start the nginx server
ENTRYPOINT ["/usr/sbin/nginx", "-g", "daemon off;"]
