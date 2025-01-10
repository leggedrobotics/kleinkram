# Build Stage
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN yarn install

CMD npm run docs:dev /app/src
