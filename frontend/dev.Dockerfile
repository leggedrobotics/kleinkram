# Build stage
FROM node:24-alpine as build-stage

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

ENTRYPOINT yarn dev
