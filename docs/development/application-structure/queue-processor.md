# Queue Processor

The Queue Processor (`queueConsumer/`) is a NodeJS application. It reads jobs from the Redis queues and processes them.
The jobs are scheduled by the API. It is implemented in TypeScript with NestJS and TypeORM, and uses the `bull` library
through `@nestjs/bull` for queuing. The documentation can be found [here](https://docs.nestjs.com/techniques/queues).

As it connects directly to the Postgres database it needs to use the same schema. Thus the entities, enums and
environment variables are shared with the API in the `packages/backend-common` workspace package.

## Structure

| Directory               | Queue                     | Description                                                                                                     |
| ----------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/file-processor`    | `file-queue`              | Ingests uploaded files (S3 or Google Drive), extracts their metadata and converts ROS 1 bags to MCAP.           |
| `src/actions`           | `action-queue-<hostname>` | Runs actions in Docker containers: pulling images, starting and watching containers, logs and artifacts.        |
| `src/trigger-processor` | `trigger-queue`           | Starts actions for file and time schedule triggers.                                                             |
| `src/fileCleanup`       | `file-cleanup`            | Marks stalled uploads as failed and repairs missing file hashes.                                                |
| `src/accessGroupExpiry` | -                         | Removes expired access group memberships.                                                                       |
| `src/artifactUpload`    | -                         | The Python uploader. It runs in its own container after an action and uploads the `/out` folder as an artifact. |

Every queue consumer has its own action queue, named after its hostname, so the API can send an action to a worker with
the right hardware. The recurring jobs are listed in [Cron Jobs](../cron/CronJobs.md).
