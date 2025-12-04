FROM node:24-alpine

ARG USER_ID=1000
ARG GROUP_ID=1000

RUN if [ ${USER_ID} -ne 1000 ]; then \
    deluser --remove-home node && \
    addgroup -g ${GROUP_ID} node && \
    adduser -u ${USER_ID} -G node -s /bin/sh -D node; \
    fi

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-dto/package.json ./packages/api-dto/
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

# build the app
WORKDIR /usr/src/app
RUN chown -R node:node /usr/src/app
USER node
CMD ["yarn", "start:dev"]
