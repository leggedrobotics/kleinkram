# Build stage
FROM node:24-alpine AS build-stage

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}

RUN apk add --no-cache bash git

WORKDIR /app

RUN mkdir -p /app/common /app/frontend && chown -R node:node /app

USER node

# Dependency Layer (Cached)
COPY --chown=node:node ./common/package.json ./common/
COPY --chown=node:node ./common/yarn.lock ./common/
COPY --chown=node:node ./frontend/package.json ./frontend/
COPY --chown=node:node ./frontend/yarn.lock ./frontend/
COPY --chown=node:node ./common/frontend_shared ./common/frontend_shared

# Install dependencies
WORKDIR /app/common
RUN yarn --immutable

WORKDIR /app/frontend
RUN yarn install --ignore-engines --immutable

# Copy source code
COPY --chown=node:node ./frontend/. ./

# Copy git metadata
COPY --chown=node:node ./.git/HEAD ./.git/HEAD
COPY --chown=node:node ./.git/refs/heads/ ./.git/refs/heads/

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
