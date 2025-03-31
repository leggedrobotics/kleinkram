# ---- Builder Stage ----
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY ./backend/package.json ./backend/yarn.lock ./backend/
COPY ./common/package.json ./common/yarn.lock ./common/

WORKDIR /usr/src/app/backend
RUN yarn install --frozen-lockfile

WORKDIR /usr/src/app/common
RUN yarn install --frozen-lockfile

# Copy the rest of the files
COPY ./backend /usr/src/app/backend
COPY ./common /usr/src/app/common

WORKDIR /usr/src/app/backend

RUN yarn run build

RUN yarn install --production --ignore-scripts --prefer-offline


# ---- Final Stage ----
FROM node:22-alpine AS final

# Install runtime dependencies needed by the application or entrypoint script
RUN apk --no-cache add postgresql-client bash # Added bash as entrypoint uses it

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy necessary artifacts from the builder stage
COPY --from=builder /usr/src/app/backend/package.json /usr/src/app/backend/package.json
COPY --from=builder /usr/src/app/backend/node_modules ./node_modules
COPY --from=builder /usr/src/app/backend/dist ./dist
COPY ./backend/entrypoint.sh ./entrypoint.sh

RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["bash", "entrypoint.sh"]