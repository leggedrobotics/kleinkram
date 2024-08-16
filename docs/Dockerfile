# Build Stage
FROM node:18.14-alpine3.17 as builder

WORKDIR /app

# Install dependencies
COPY package*.json ./


RUN --mount=type=cache,target=~/.yarn-cache yarn install

# Build the docs
COPY . ./
RUN yarn run docs:build


FROM nginx:1.23.2-alpine

# Copy the builded docs
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# Copy the nginx config
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Start the nginx server
CMD nginx -g "daemon off;"