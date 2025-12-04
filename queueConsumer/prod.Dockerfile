FROM node:24-alpine

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend-common/package.json ./packages/backend-common/
COPY queueConsumer/package.json ./queueConsumer/

RUN yarn install --frozen-lockfile

RUN wget https://github.com/foxglove/mcap/releases/download/releases%2Fmcap-cli%2Fv0.0.42/mcap-linux-amd64 -O /usr/local/bin/mcap \
    && chmod +x /usr/local/bin/mcap \
    && apk add --no-cache crane --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community

# copy the rest of the files
WORKDIR /usr/src/app
COPY packages ./packages
COPY queueConsumer ./queueConsumer

WORKDIR /usr/src/app/queueConsumer
ENV PATH /usr/src/app/node_modules/.bin:$PATH
RUN yarn build

# build the app
WORKDIR /usr/src/app/queueConsumer
CMD ["yarn", "start:prod"]
