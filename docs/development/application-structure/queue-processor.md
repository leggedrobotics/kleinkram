# Queue Processor

The Queue Processor is a NodeJS application. It reads from the Redis queue and processes the tasks. The tasks are
scheduled by the API. The QueingService is responsible for offloading heavy processing from the API.

For more information see the [QueingService Documentation](./queuingService/README.md)

The Queue Processor also uses NestJS & TypeORM. But with `@nestjs/bull` for Queuing. The Documentation can be
found [here](https://docs.nestjs.com/techniques/queues).

As it connects directly to the Postres Database it needs to use the same schema. Thus the entities, enums and
environment variables are in the `common` folder.

## Structure

In `src/entities` are the entities. In `src/helper` are helper function for Google Drive handling and Minio handling.

In `src/files/fileQueueProcessor.provider.ts` is the logic for Bag -> MCap conversion.
In `src/actions/fileQueueProcessor.provider.ts` is the logic for the actions.
