FROM node:21-alpine

WORKDIR /usr/src/queueConsumer
RUN ls
COPY package.json ./
COPY yarn.lock ./

RUN yarn
RUN wget https://github.com/foxglove/mcap/releases/download/releases%2Fmcap-cli%2Fv0.0.42/mcap-linux-amd64 -O /usr/local/bin/mcap \
    && chmod +x /usr/local/bin/mcap
COPY . .

RUN rm -rf dist

#RUN yarn build
CMD ["yarn", "start:dev"]
