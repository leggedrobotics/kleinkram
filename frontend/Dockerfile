# Build stage
FROM node:22-alpine AS build-stage

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}
RUN echo "QUASAR_ENDPOINT is set to ${QUASAR_ENDPOINT}"

WORKDIR /app

COPY ./common/package.json ./common/
COPY ./common/yarn.lock ./common/

COPY ./frontend/package.json ./frontend/
COPY ./frontend/yarn.lock ./frontend/
COPY ./common/frontend_shared ./common/frontend_shared

COPY ./.git/HEAD /app/frontend/.git/HEAD
COPY ./.git/refs/heads/ /app/frontend/.git/refs/heads/


WORKDIR /app/common
RUN yarn --immutable

WORKDIR /app/frontend
RUN yarn install --ignore-engines --immutable

COPY ./frontend/. ./

RUN export VITE_QUASAR_VERSION=$(node -pe "require('./package.json').version") && \
    echo "VITE_QUASAR_VERSION is set to ${VITE_QUASAR_VERSION}" && \
    yarn build

# Production stage
FROM nginx:alpine AS production-stage

# copy the nginx configuration file to the container
COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build-stage /app/frontend/dist/spa /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
