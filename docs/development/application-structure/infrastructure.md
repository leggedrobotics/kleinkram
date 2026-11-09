# Infrastructure Services

The application relies on several infrastructure services running alongside the core application containers. These services handle storage, caching, monitoring, logging, and documentation.

## Storage & Caching

### SeaweedFS (Object Storage)

SeaweedFS is a high-performance distributed storage system for blobs, objects, files, and data lake, compatible with the Amazon S3 API. It is used to store unstructured data such as mission files (`.bag`, `.mcap`) and artifacts.

**Key Buckets:**

- `data`: Stores all mission files.
    - Files are named using their UUID (matching the database entry).
    - Metadata (filename, missionUuid, projectUuid) is stored as object tags.
- `artifacts`: Stores Kleinkram action artifacts.
    - Files are named using the action UUID.
- `dbdump`: Stores scheduled PostgreSQL database dumps.
    - Filenames follow the pattern `backup-<timestamp>.sql`.

The API server should never download or upload files directly to avoid performance bottlenecks. Instead, it issues presigned URLs or temporary credentials for clients to interact with SeaweedFS directly.

**Development Access:**
Dashboard: `http://localhost:9333`
S3 API: `http://localhost:9000`

Default Credentials: `seaweed` / `seaweed` (configured via environment)

::: warning Production Deployment
The default provided `docker-compose.prod.yml` runs SeaweedFS with a single `server` command that includes all components (master, volume, filer, and S3 gateway) in one process. This setup is convenient for development but may have scalability and reliability implications for production.

In production deployments, you should typically run these components separately instead of using our default configuration. This provides better fault isolation and horizontal scaling. For more information, please see the [official SeaweedFS Components Documentation](https://github.com/seaweedfs/seaweedfs/wiki/Components).
:::

### Redis (Queue & Cache)

Redis is an in-memory key-value store used primarily for managing the job queue.

- **Queue Management**: The API pushes tasks to the queue.
- **Processing**: The Queue Processor service consumes tasks from the Redis queue.

### Loki (Logging)

Loki is a log aggregation system. It collects logs from all actions and stores them in a time series database.

Because action logs are only readable through Loki, the API refuses to dispatch an action while Loki is unavailable;
such a run would execute with no retrievable logs. The rejection is a `503` with a `Retry-After` header, since it says
nothing about the submitted action itself.

Loki reports `/ready` as `503` for roughly 15 seconds after startup (ring join, WAL replay, `min_ready_duration`). The
compose setups therefore gate `api-server` and `queue-consumer` on a one-shot `loki-ready` container rather than on
`loki` itself, so a freshly started stack never accepts submissions it is going to reject.

`LOKI_URL` points the services at Loki and defaults to `http://loki:3100`, the address inside the compose network. When
running the API on the host (`pnpm dev`), set `LOKI_URL=http://localhost:3100` in your `.env`.

## Monitoring & Observability

The platform uses a comprehensive stack for monitoring, logging, and tracing.

### Prometheus

Prometheus is a time-series database and monitoring toolkit. It scrapes metrics from the application services and infrastructure components to monitor health and performance.

### Grafana

Grafana is the visualization platform used to display metrics, logs, and traces. It provides dashboards to visualize data collected by Prometheus, Loki, and Tempo.

### Loki

Grafana Loki is a log aggregation system. It collects logs from all containers, allowing for centralized log search and analysis within Grafana.

### Tempo

Grafana Tempo is a distributed tracing backend. It stores traces to help visualize the flow of requests through the microservices, aiding in performance debugging.

## Documentation

### Docs Service

The documentation (this site) is built using **VitePress** and runs as a standalone service container. It serves the static site generated from markdown files in the `docs` directory.
