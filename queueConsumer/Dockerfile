FROM node:21-alpine

WORKDIR /usr/src/queueConsumer
RUN ls
COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . .

RUN rm -rf dist

#RUN yarn build
CMD ["yarn", "start:dev"]
