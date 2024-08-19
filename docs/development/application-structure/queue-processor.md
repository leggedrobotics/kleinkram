# Queue Processor

The Queue Processor is a NodeJS application. It reads from the Redis queue and processes the tasks. The tasks are
scheduled by the API. The QueingService is responsible for offloading heavy processing from the API.

For more information see the [QueingService Documentation](./queuingService/README.md)

The Queue Processor also uses NestJS & TypeORM. But with `@nestjs/bull` for Queuing. The Documentation can be
found [here](https://docs.nestjs.com/techniques/queues).

As it connects directly to the Postres Database it needs to use the same schema. Thus in `src/entities` is a copy of all
entities from the API. This is not ideal and should be changed.
Similarly, the env.ts and enum.ts are copied from the API. This should be changed.
::: warning Duplication
How do we resolve this? copying the files in docker build doesn't directly work as they use different imports.
:::

## Structure

In `src/entities` are the entities. In `src/helper` are helper function for Google Drive handling and Minio handling.

In `src/files/fileQueueProcessor.provider.ts` is the logic for Bag -> MCap conversion.
In `src/actions/fileQueueProcessor.provider.ts` is the logic for the actions.
