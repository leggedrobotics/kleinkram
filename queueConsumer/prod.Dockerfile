# ---- Builder Stage ----
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY ./queueConsumer/package.json ./queueConsumer/yarn.lock ./queueConsumer/
COPY ./common/package.json ./common/yarn.lock ./common/

WORKDIR /usr/src/app/queueConsumer
RUN yarn install --frozen-lockfile

WORKDIR /usr/src/app/common
RUN yarn install --frozen-lockfile

# Copy the rest of the files
COPY ./queueConsumer /usr/src/app/queueConsumer
COPY ./common /usr/src/app/common

WORKDIR /usr/src/app/queueConsumer

RUN yarn run build

# ---- Final Stage ----
FROM node:22-alpine AS final

RUN apk --no-cache add postgresql-client bash

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/queueConsumer/package.json ./queueConsumer/package.json
COPY --from=builder /usr/src/app/queueConsumer/package.json /usr/src/app/queueConsumer/package.json
COPY --from=builder /usr/src/app/queueConsumer/dist ./queueConsumer/dist

COPY ./queueConsumer/package.json ./queueConsumer/yarn.lock ./
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean

EXPOSE 3000

CMD ["node", "queueConsumer/dist/queueConsumer/src/main.js"]