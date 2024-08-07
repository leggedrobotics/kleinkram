# Application Structure

This page describes the structure of the application and how it is organized.

## Service Overview

The application is composed of multiple Docker containers (services), categorized into two primary groups:

-   [**operational containers**](#operational-containers): responsible for running the application
-   [**non-operational** containers](#non-operational-containers): responsible for monitoring, logging, and documentation.

::: tip Application Structure
The application code is stored inside a monorepo.

Each service is responsible for a specific part of the application and is bundled into a Docker container. The services
are orchestrated by [Docker Compose](https://docs.docker.com/compose/).
:::

### Operational Containers

The operational containers are again split into publicly accessible and non-publicly accessible containers.

#### Publicly Accessible

-   [frontend](./application-structure/frontend.md) - the web application written using Vue3 and Quasar
-   [api-server](./application-structure/api-server.md) - the backend application written using NestJS
-   [minio](application-structure/minio.md) - the file storage

#### Private Network (Not Publicly Accessible)

-   [queue-processor](./application-structure/queue-processor.md) - The service worker processing the queues
-   [postgres](application-structure/postgres.md) - The Postres database
-   [redis](application-structure/redis.md) - Database to manage the Queue
-   `action containers` - custom containers scheduled by the `queue-processor` to perform user specific actions

## Non-Operational Containers:

-   [docs](application-structure/docs.md) - this documentation, built using VitePress
-   [prometheus](application-structure/prometheus.md) - monitoring (for time series data)
-   [tempo](application-structure/tempo.md) - tracing
-   [loki](application-structure/loki.md) - logging
-   [grafana](application-structure/grafana.md) - visualization of the monitoring dat, logs, and traces

## Infrastructure Overview

![Infrastructure.jpg](imgs/infrastructure.svg)

::: warning How to Edit the Figure
The above figure can be edited using https://drive.google.com/file/d/1w4JAuPfGMLiISAmuAbiq0NbgInp4VGlP/view?ts=6666d313
:::
