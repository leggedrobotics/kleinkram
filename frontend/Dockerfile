FROM node:21-alpine as build-stage

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --ignore-engines

COPY . .

RUN yarn build
