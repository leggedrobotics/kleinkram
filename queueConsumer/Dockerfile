FROM node:21-alpine

COPY ./queueConsumer/package.json /usr/src/queueConsumer/
COPY ./queueConsumer/yarn.lock /usr/src/queueConsumer/
COPY ./common/package.json /usr/src/common/
COPY ./common/yarn.lock /usr/src/common/

WORKDIR /usr/src/queueConsumer
RUN yarn
RUN wget https://github.com/foxglove/mcap/releases/download/releases%2Fmcap-cli%2Fv0.0.42/mcap-linux-amd64 -O /usr/local/bin/mcap \
    && chmod +x /usr/local/bin/mcap

WORKDIR /usr/src/common
RUN yarn

# copy the rest of the files
COPY ./queueConsumer /usr/src/queueConsumer
COPY ./common /usr/src/common

# build the app
WORKDIR /usr/src/queueConsumer
CMD ["yarn", "start"]
