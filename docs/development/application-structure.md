# Application Structure

This document describes the structure of the application and how it is organized.

The application consists of 12 Docker containers grouped into operational and non-operational containers. The operational containers are responsible for running the application, while the non-operational containers are responsible for Monitoring and Documentation.

The operaional Containers are again split into publicly accessible and non-publicly accessible containers. 
Publicly accessible are:
- `Frontend` - The web application
- `API` - The backend application
- `Minio` - The file storage

In a private network are:
- `Postgres` - The Postres database
- `Redis` - Database to manage the Queue
- `QueingService` - The service worker processing the queues
- `Action Container` - Custom container by users scheduled by the QueingService

The non-operational containers are:
- `Docs` - This documentation
- `Prometheus` - ??
- `Grafana` - ??
- `Tempo` - ??
- `Loki` - ??


![Infrastructure.jpg](..%2Fimg%2FInfrastructure.jpg)

## Frontend
The Fronted is a Vue3 application with the Quasar Framework & Component Library. It is responsible for the user interface. The Frontend is statically served by the Nginx in the Frontend container.

For more information see the [Frontend Documentation](./frontend/README.md)

## API
The API is a NestJS application with TypeORM as an ORM. It is responsible for the business logic and the communication with the database. 

For more information see the [API Documentation](./api/README.md)

## Minio
Minio is a high-performance object storage. It is used to store files. The API should never handle files directly. These files can be too large and slow down the API. Instead, the API should use presigned URLs to Minio so that files are directly uploaded to & downloaded from Minio.

In minio are two buckets: one for `.bag` files and one for `.mcap` files. The files are grouped by their Project and Mission.

## Postgres
Postgres is a relational database. It is used to store the data of the application. The database is only accessed by the API & the QueingService.
::: warning Todo
Find out how to handle the database migrations
:::

## Redis
Redis is a key-value store. It is used to manage the queue. The QueingService reads from the queue and processes the tasks. The API adds tasks to the queue.

## QueingService
The QueingService is a NodeJS application. It reads from the Redis queue and processes the tasks. The tasks are scheduled by the API. The QueingService is responsible for offloading heavy processing from the API.

For more information see the [QueingService Documentation](./queuingService/README.md)





::: danger Not Yet Documented
This document is a work in progress and will be updated as the project evolves.
:::