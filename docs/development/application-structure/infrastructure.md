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

### Redis (Queue & Cache)

Redis is an in-memory key-value store used primarily for managing the job queue.

- **Queue Management**: The API pushes tasks to the queue.
- **Processing**: The Queue Processor service consumes tasks from the Redis queue.

### Loki (Logging)

Loki is a log aggregation system. It collects logs from all actions and stores them in a time series database.

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
