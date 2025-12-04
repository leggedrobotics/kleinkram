# Build stage
FROM node:24-alpine AS build-stage

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}

RUN apk add --no-cache bash git

WORKDIR /app

RUN mkdir -p /app/common /app/frontend && chown -R node:node /app

USER node

# Dependency Layer (Cached)
# Dependency Layer (Cached)
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY frontend ./frontend

# Copy git metadata
COPY ./.git/HEAD ./frontend/.git/HEAD
COPY ./.git/refs/heads/ ./frontend/.git/refs/heads/

WORKDIR /app/frontend

# Run the build script and build
RUN export VITE_QUASAR_VERSION=$(node -pe "require('./package.json').version") && \
    echo "VITE_QUASAR_VERSION is set to ${VITE_QUASAR_VERSION}" && \
    chmod +x ./create_build_info.sh && \
    ./create_build_info.sh && \
    yarn build && \
    rm -rf node_modules

# Production stage
FROM nginx:alpine AS production-stage

COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/frontend/dist/spa /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
