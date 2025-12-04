# Build stage
FROM node:24-alpine as build-stage

ARG USER_ID=1000
ARG GROUP_ID=1000

RUN if [ ${USER_ID} -ne 1000 ]; then \
    deluser --remove-home node && \
    addgroup -g ${GROUP_ID} node && \
    adduser -u ${USER_ID} -G node -s /bin/sh -D node; \
    fi

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}
RUN echo "QUASAR_ENDPOINT is set to ${QUASAR_ENDPOINT}"


WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-dto/package.json ./packages/api-dto/
COPY frontend/package.json ./frontend/

RUN yarn install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/api-dto ./packages/api-dto
COPY frontend ./frontend

WORKDIR /app/frontend
RUN chown -R node:node /app
USER node
ENTRYPOINT yarn dev
