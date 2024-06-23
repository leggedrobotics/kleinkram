FROM node:21-alpine

COPY ./backend/package.json /usr/src/app/backend/
COPY ./backend/yarn.lock /usr/src/app/backend/
COPY ./common/package.json /usr/src/app/common/
COPY ./common/yarn.lock /usr/src/app/common/

WORKDIR /usr/src/app/backend
RUN yarn

WORKDIR /usr/src/app/common
RUN yarn

# copy the rest of the files
COPY ./backend /usr/src/app/backend
COPY ./common /usr/src/app/common

# build the app
WORKDIR /usr/src/app/backend
RUN yarn build

# marke the entrypoint.sh as executable
RUN chmod +x entrypoint.sh
CMD ["sh", "entrypoint.sh"]