FROM node:21

WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y zstd lz4 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . .

RUN rm -rf dist

RUN yarn build
CMD ["yarn", "start:dev"]