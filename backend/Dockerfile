FROM node:24-alpine

ARG USER_ID=1000
ARG GROUP_ID=1000

RUN if [ ${USER_ID} -ne 1000 ]; then \
    deluser --remove-home node && \
    addgroup -g ${GROUP_ID} node && \
    adduser -u ${USER_ID} -G node -s /bin/sh -D node; \
    fi

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-dto/package.json ./packages/api-dto/
COPY packages/backend-common/package.json ./packages/backend-common/
COPY backend/package.json ./backend/

RUN yarn install --frozen-lockfile

RUN apk --no-cache add postgresql-client git python3 py3-pip build-base python3-dev
RUN pip3 install rosbags --break-system-packages

# copy the rest of the files
WORKDIR /usr/src/app
COPY packages ./packages
COPY backend ./backend

# build the app
WORKDIR /usr/src/app/backend
# marke the entrypoint.sh as executable
RUN chmod +x entrypoint.sh
RUN chown -R node:node /usr/src/app
USER node
CMD ["sh", "entrypoint.sh"]
