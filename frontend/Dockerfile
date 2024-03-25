# Build stage
FROM node:21-alpine as build-stage

WORKDIR /app

COPY ./package.json ./
COPY ./yarn.lock ./

RUN yarn install --ignore-engines

COPY . .

RUN yarn build

# Production stage
FROM nginx:alpine as production-stage

COPY --from=build-stage /app/dist/spa /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
