ARG MODE="production"

# Build Stage
FROM node:24-alpine AS builder
ARG MODE

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN yarn install

# Build the docs
COPY . ./

# run docs:build:staging or docs:build depending on the MODE
RUN yarn run docs:build:${MODE}


FROM nginx:1.23.2-alpine

# Copy the builded docs
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# Copy the nginx config
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Start the nginx server
CMD nginx -g "daemon off;"
