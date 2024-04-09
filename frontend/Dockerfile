# Build stage
FROM node:20-alpine as build-stage

ARG QUASAR_ENDPOINT
ENV QUASAR_ENDPOINT=${QUASAR_ENDPOINT}
RUN echo "QUASAR_ENDPOINT is set to ${QUASAR_ENDPOINT}"


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
