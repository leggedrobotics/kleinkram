# Build stage
FROM node:20-alpine as build-stage

ARG QUASAR_ENDPOINT
ENV VITE_QUASAR_ENDPOINT=${QUASAR_ENDPOINT}
RUN echo "QUASAR_ENDPOINT is set to ${QUASAR_ENDPOINT}"


WORKDIR /app

COPY ./package.json ./
COPY ./yarn.lock ./

# Extract version from package.json and set it as an environment variable
RUN export VITE_QUASAR_VERSION=$(node -pe "require('./package.json').version") && \
    echo "VITE_QUASAR_VERSION is set to ${VITE_QUASAR_VERSION}" && \
    echo "VITE_QUASAR_VERSION=${VITE_QUASAR_VERSION}" >> .env



RUN yarn install --ignore-engines

COPY . .

RUN yarn build

# Production stage
FROM nginx:alpine as production-stage

COPY --from=build-stage /app/dist/spa /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
