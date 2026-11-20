# API

The API is a NestJS application with TypeORM as an ORM. It is responsible for the business logic and the communication
with the database.

::: tip External Resources
Read the [NestJS Documentation](https://docs.nestjs.com/) and the [TypeORM Documentation](https://typeorm.io/#/).
:::

It has a direct connection to the Postgres database. It also has a direct connection to the Redis database to add items
to the queue.

In its environment variables it has the keys to access S3 (SeaweedFS) and can thus list and move files in it. It should never
download or upload files directly.

## Structure

The API lives in the `backend` directory. The `src` directory contains the source code; the entities, enums and
environment variables are shared with the queue processor in the `packages/backend-common` workspace package.

### Configuration Files

- `package.json` - Contains the dependencies and scripts for the application.
- `tsconfig.json` - Contains the configuration for the TypeScript compiler.
- `entrypoint.sh` - Starts the API in the container (watch mode and seeding in development builds).
- `migration/` - The TypeORM migrations, see [Database Migration](../migrations/migrations.md).
- The Docker image is built from `docker/backend.Dockerfile` in the repository root.

### Source Code

| Directory               | Description                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `src/endpoints/<name>/` | One NestJS module per resource (`project`, `mission`, `file`, `action`, ...), with its controller. |
| `src/endpoints/auth/`   | Login strategies (Google, GitHub, fake OAuth for development), JWT handling and the access guards. |
| `src/services/`         | The business logic, shared by the controllers.                                                     |
| `src/routing/`          | Middlewares, interceptors, exception filters and pipes that apply to every request.                |
| `src/serialization/`    | Helpers that turn entities into the DTOs of `packages/api-dto`.                                    |

Each entity inherits from the `BaseEntity` class. This class adds basic fields like `uuid`, `createdAt`, `deletedAt`,
and `updatedAt`.

::: info Soft deletes
The `deletedAt` field is used for soft deletes: deleting an entity sets the field to the current date instead of
removing the row, and TypeORM leaves such rows out of queries.
:::

The storage system uses a bucket-based abstraction (`IStorageBucket`). Specific buckets (e.g., `DataStorageBucket`, `ArtifactStorageBucket`) are injected into services to handle object storage. This abstracts away the underlying provider (S3/SeaweedFS).

### Middlewares

Every request passes through these middlewares (`src/routing/middlewares/`):

- `response-compression.ts` - Compresses responses, see `API_COMPRESSION_ENABLED` in the
  [Environment Variables](../environment-variables.md).
- `api-key-resolver-middleware.service.ts` - Resolves the API key of an action (cookie or `x-api-key` header) to its
  user.
- `audit-logger-middleware.service.ts` - Records the requests an action makes with its API key in the action's audit
  log.
- `version-checker-middleware.service.ts` - Rejects clients whose version is too old with `426 Upgrade Required`.

## Development

The API should remain stateless (besides the database connections). This will allow parallelization and scaling of the
API.

The API should never handle files directly. These files can be too large and slow down the API. Instead, the API
issues temporary credentials for S3 so that files are directly uploaded to & downloaded from S3.

Similarly, the API should never do heavy processing. Tasks that require this should be offloaded to the queue processor
through the `QueueService`.

Use ESLint and Prettier to format the code. The code should be formatted before committing. The code should be
linted before pushing. The code should be tested before merging.

### Logging and Tracing

`src/logger.ts` is a Winston logger that writes to the console and sends the logs to Loki. `src/tracing.ts` sets up
OpenTelemetry: traces are exported to Tempo over OTLP, metrics are exposed for Prometheus. See
[Infrastructure](./infrastructure.md) for the observability stack.

## Authentication

Users log in with Google, GitHub or, in development, the fake OAuth provider (`src/endpoints/auth/*.strategy.ts`). The
API then sets a session cookie; the CLI uses the same session through a device login. Actions authenticate with an
API key (a cookie or the `x-api-key` header) that is only valid for their own mission while they run.

Endpoints declare who may call them with the decorators from `src/endpoints/auth/guards/`, for example:

| Decorator                                                        | Allows                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@LoggedIn()`                                                    | Any logged-in user or action API key.                              |
| `@UserOnly()`                                                    | Logged-in users, but not action API keys.                          |
| `@AdminOnly()`                                                   | Admins.                                                            |
| `@CanCreate()`                                                   | Users who may create projects (admins, affiliation group members). |
| `@CanReadProject()`, `@CanWriteProject()`, `@CanDeleteProject()` | Users with that right on the project in the request.               |
| `@CanReadMission()`, ...                                         | The same for missions, files, actions and access groups.           |

See [Access Control](../access-control/base-concepts.md) for how the rights are computed.
