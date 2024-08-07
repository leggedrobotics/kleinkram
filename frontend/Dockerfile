# Build stage
FROM node:22-alpine as build-stage

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}
RUN echo "QUASAR_ENDPOINT is set to ${QUASAR_ENDPOINT}"


WORKDIR /app

COPY ./frontend/package.json ./
COPY ./frontend/yarn.lock ./
COPY ./.git/HEAD /app/.git/HEAD
COPY ./.git/refs/heads/ /app/.git/refs/heads/

RUN yarn install --ignore-engines --immutable

COPY ./frontend/. .

RUN export VITE_QUASAR_VERSION=$(node -pe "require('./package.json').version") && \
    echo "VITE_QUASAR_VERSION is set to ${VITE_QUASAR_VERSION}" && \
    yarn build

# Production stage
FROM nginx:alpine as production-stage

COPY --from=build-stage /app/dist/spa /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
