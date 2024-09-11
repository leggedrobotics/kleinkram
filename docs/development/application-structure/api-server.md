# API

The API is a NestJS application with TypeORM as an ORM. It is responsible for the business logic and the communication
with the database.

::: tip External Resources
Read the [NestJS Documentation](https://docs.nestjs.com/) and the [TypeORM Documentation](https://typeorm.io/#/).
:::

It has a direct connection to the Postgres database. It also has a direct connection to the Redis database to add items
to the queue.

In its environment variables it has the keys to access Minio and can thus list and move files in Minio. It should never
download or upload files directly.

## Structure

Within the `api` directory, at the root level are the key configuration files for the API application. The `src`
directory contains the source code for the application.

### Configuration Files

-   `package.json` - Contains the dependencies and scripts for the application.
-   `tsconfig.json` - Contains the configuration for the TypeScript compiler.
-   `Dockerfile` - Contains the instructions to build the Docker image for the application.

### Source Code

The Source Code is structured into modules. Each module handles the logic for an entity. Each module is structured
identically:

-   `module` - The module contains the configuration for the module.
-   `controller` - The controller handles the incoming requests and outgoing responses.
-   `service` - The service handles the business logic.
-   `entities/` - Contains .dto files for the data transfer objects. The entities are moved to the toplevel 'common' 
folder as they are shared with the queue-processor.

Each entity should inherit from the `BaseEntity` class. This class adds basic fields
like `uuid`, `createdAt`, `deletedAt`, and `updatedAt`.
::: warning
The `deletedAt` field is used for soft deletes. The field is set to the current date when the entity is deleted. The
entity is not removed from the database.
Are we using this? Should we?
:::

Some functions were extracted into services. They are currently in the root of the `src` directory. Logger & Tracing
handle the respective tasks.
The minioHelper is a helper function to interact with the Minio storage.

## Development

The API should remain stateless (besides the database connections). This will allow parallelization and scaling of the
API.

The API should never handle files directly. These files can be to large and slow down the API. Instead, the API should
use issue temporary credential for Minio so that files are directly uploaded to & downloaded from Minio.

Similarly, the API should never do heavy processing. Tasks that require this should be offloaded to the QueingService.
The QueingService will then schedule the task.

Use the eslint and prettier to format the code. The code should be formatted before committing. The code should be
linted before pushing. The code should be tested before merging.

::: warning
How to log & trace
:::

## Authentication

::: danger
Documentation is missing
:::
