FROM node:24-alpine

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend-common/package.json ./packages/backend-common/
COPY backend/package.json ./backend/

RUN yarn install --frozen-lockfile

RUN apk --no-cache add postgresql-client

# copy the rest of the files
WORKDIR /usr/src/app
COPY packages ./packages
COPY backend ./backend

# build the app
WORKDIR /usr/src/app/backend
RUN yarn run build
# marke the entrypoint.sh as executable
RUN chmod +x entrypoint.sh
CMD ["sh", "entrypoint.sh"]
