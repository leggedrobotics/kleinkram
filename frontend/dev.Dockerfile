# Build stage
FROM node:20-alpine as build-stage

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}
RUN echo "QUASAR_ENDPOINT is set to ${QUASAR_ENDPOINT}"


WORKDIR /app

COPY ./frontend/package.json ./
COPY ./frontend/yarn.lock ./
COPY ./.git/HEAD /app/.git/HEAD
COPY ./.git/refs/heads/ /app/.git/refs/heads/

RUN yarn install --ignore-engines

COPY ./frontend/. .

ENTRYPOINT yarn dev