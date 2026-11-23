# Environment Variables

This document lists the environment variables used to configure the Kleinkram application. These variables are typically defined in a `.env` file in the root directory. The compose files set some of them per service (e.g. `REDIS_HOST`, `ACCESS_CONFIG_PATH`), overriding `.env`.

The **Default** column shows the value from the committed `.env`, or the fallback in the code when the variable is unset. Variables without a fallback are required: the service fails at startup when they are missing.

## Server Configuration

| Variable                  | Description                                                                                                                                                                                   | Default |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| `SERVER_PORT`             | The port on which the backend server listens.                                                                                                                                                 | `3000`  |
| `API_COMPRESSION_ENABLED` | Compress API responses larger than 1 KB with Brotli or gzip, depending on the client's `Accept-Encoding`. Set to `false` if a reverse proxy in front of the API already compresses responses. | `true`  |

Compression runs in the API server itself, so every deployment gets it without proxy configuration. Server-sent
events (`text/event-stream`) are never compressed, and a client can opt out for a single request by sending the
`x-no-compression` header.

## Service URLs

These URLs are used for communication between services and for generating links.

| Variable       | Description                                           | Default                 |
| :------------- | :---------------------------------------------------- | :---------------------- |
| `FRONTEND_URL` | The URL where the frontend application is accessible. | `http://localhost:8003` |
| `DOCS_URL`     | The URL where the documentation site is accessible.   | `http://localhost:4000` |
| `BACKEND_URL`  | The URL where the backend API is accessible.          | `http://localhost:3000` |
| `REDIS_HOST`   | Hostname of the Redis server holding the queues.      | `localhost`             |
| `LOKI_URL`     | Base URL of the Loki instance storing action logs.    | `http://loki:3100`      |

::: warning Use https outside local development
Except on `localhost`, Kleinkram must be served over https. The login cookies are always marked `Secure`, so
browsers only send them over https (or to `http://localhost`), and the CLI refuses plain `http://` servers. On a
plain http address other than `localhost`, logging in does not work.
:::

## S3 Configuration (Object Storage)

Configuration for SeaweedFS (or S3-compatible storage), which is used for object storage.

| Variable                   | Description                                                                               | Default                                    |
| :------------------------- | :---------------------------------------------------------------------------------------- | :----------------------------------------- |
| `S3_ACCESS_KEY`            | The access key for S3 clients.                                                            | `pMEKIOCnYJhmssiKZDGU`                     |
| `S3_SECRET_KEY`            | The secret key for S3 clients.                                                            | `ECnXGyUR5ZrPsxeD5JEWxtI1CMZFMJ8kTJMMAQ5B` |
| `S3_DATA_BUCKET_NAME`      | The bucket name for main data storage.                                                    | `data`                                     |
| `S3_DB_BUCKET_NAME`        | Bucket for database dumps (created by SeaweedFS, written by the deployment's backup job). | `dbdumps`                                  |
| `S3_ARTIFACTS_BUCKET_NAME` | The bucket name for build artifacts.                                                      | `artifacts`                                |
| `S3_SCRIPTS_BUCKET_NAME`   | The bucket name for single-file action scripts. Optional, unlike the other buckets.       | `action-scripts`                           |
| `S3_ENDPOINT`              | The S3 address that clients outside Docker (browsers, the CLI, action containers) use.    | `localhost`                                |
| `S3_ENDPOINT_INTERNAL`     | The S3 address the API and the queue consumer use inside the Docker network.              | `seaweedfs:9000`                           |
| `S3_REGION`                | Region sent to the S3 API.                                                                | `us-east-1`                                |

## Database Configuration

Configuration for the PostgreSQL database.

| Variable           | Description                                                                                                                                | Default                                                               |
| :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `DB_HOST`          | The hostname of the database server.                                                                                                       | `database`                                                            |
| `DB_PORT`          | The port of the database server.                                                                                                           | `5432`                                                                |
| `DB_DATABASE`      | The name of the database.                                                                                                                  | `dbname`                                                              |
| `DB_USER`          | The database username.                                                                                                                     | `dbuser`                                                              |
| `DB_PASSWORD`      | The database password.                                                                                                                     | `dbuserpass`                                                          |
| `DB_SSL`           | Set to `true` to connect to the database over TLS.                                                                                         | `false`                                                               |
| `DATA_SOURCE_NAME` | Connection string for the `postgres-exporter` of the local compose setup (Prometheus metrics). Kleinkram itself uses the `DB_*` variables. | `postgresql://dbuser:dbuserpass@database:5432/dbname?sslmode=disable` |
| `DEV`              | Set to `true` to enable development features (verbose logging, etc.).                                                                      | `true`                                                                |

## Seeding Configuration

| Variable | Description                                                               | Default |
| :------- | :------------------------------------------------------------------------ | :------ |
| `SEED`   | Set to `true` to populate the database with initial seed data on startup. | `true`  |

## Authentication Configuration

| Variable                              | Description                                                                                                        | Default                       |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------- | :---------------------------- |
| `VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT` | Set to `true` to enable the mock OAuth provider for local dev. Read by the API and, at build time, by the web app. | `true`                        |
| `GOOGLE_KEY_FILE`                     | Path to the Google Cloud service account key file.                                                                 | `google-service-account.json` |
| `GOOGLE_CLIENT_ID`                    | Google OAuth Client ID.                                                                                            | -                             |
| `GOOGLE_CLIENT_SECRET`                | Google OAuth Client Secret.                                                                                        | -                             |
| `GITHUB_CLIENT_ID`                    | GitHub OAuth Client ID.                                                                                            | -                             |
| `GITHUB_CLIENT_SECRET`                | GitHub OAuth Client Secret.                                                                                        | -                             |

### Access Config

| Variable             | Description                                                                                                                                                                                                                                                                                                                                                                              | Default                                             |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| `ACCESS_CONFIG_PATH` | Path (inside the container) to the `access_config.json` that defines the affiliation groups and whether external users may sign in (`allow_external_users`, see [Access Control](./access-control/base-concepts.md#restricting-sign-in-to-internal-users)). Required: the backend refuses to start without a valid config. The compose files set it to `/app/config/access_config.json`. | `/app/backend/access_config.dev.json` (from `.env`) |
| `ACCESS_CONFIG_FILE` | Host path of the deployment's `access_config.json`, mounted by `docker-compose.dev.yml` and `docker-compose.prod.yml`.                                                                                                                                                                                                                                                                   | `./access_config.json`                              |
| `JWT_SECRET`         | Secret key used to sign and verify JWT tokens.                                                                                                                                                                                                                                                                                                                                           | `SECRET`                                            |

## Docker & Registry Configuration

| Variable                    | Description                                                                                                                                                                                                             | Default                                      |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| `DOCKER_HUB_USERNAME`       | Username for Docker Hub authentication.                                                                                                                                                                                 | -                                            |
| `DOCKER_HUB_PASSWORD`       | Password for Docker Hub authentication.                                                                                                                                                                                 | -                                            |
| `VITE_DOCKER_HUB_NAMESPACE` | Restricts allowed Docker images to one Docker Hub namespace (see [Writing Actions](../usage/actions/write-actions.md#push-actions-to-docker-hub)). Read by the API, the queue consumer and, at build time, the web app. | -                                            |
| `ARTIFACTS_UPLOADER_IMAGE`  | Docker image used for uploading artifacts.                                                                                                                                                                              | `rslethz/kleinkram:artifact-uploader-latest` |
| `DOCKER_GID`                | The group ID of the docker group on the host system (`stat -c '%g' /var/run/docker.sock`). The compose files fall back to `999`.                                                                                        | `984`                                        |

## Web App (Build Time)

The web app is a static build: these variables are read when it is built (`docker/frontend.Dockerfile` or
`quasar build`), not when it runs. Besides `BACKEND_URL`, `VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT` and
`VITE_DOCKER_HUB_NAMESPACE` from above:

| Variable           | Description                                                                                | Default                     |
| :----------------- | :----------------------------------------------------------------------------------------- | :-------------------------- |
| `VITE_S3_ENDPOINT` | The S3 address the browser uploads to. Required unless `BACKEND_URL` contains `localhost`. | `http://localhost:9000`     |
| `VITE_DOCS_URL`    | The documentation site linked from the web app.                                            | `https://kleinkram.io/docs` |

## Build and Compose

| Variable              | Description                                                                                                   | Default |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ | :------ |
| `GIT_COMMIT`          | Commit hash baked into the images. The queue consumer stores it with each action runner.                      | -       |
| `USER_ID`, `GROUP_ID` | User and group ID the development images run as, so files written to mounted volumes belong to you.           | `1000`  |
| `DEVBUILD`            | Set by the compose files. `true` starts the API in watch mode, generates the API docs and seeds the database. | -       |
