# Queue Consumer - AI Agent Documentation

> **Purpose**: This document provides a detailed overview of the Kleinkram queue consumer architecture for AI agents.

## Overview

The queue consumer is a **NestJS background job processor** that handles asynchronous, resource-intensive operations. It processes jobs from Redis queues using Bull and runs independently of the main backend API.

**Key Responsibilities**:
- File processing (upload, conversion, metadata extraction)
- Action execution (Docker container orchestration)
- File cleanup and recovery
- Access group expiry management
- System maintenance tasks

**Technology Stack**: NestJS, Bull (Redis), Docker/Dockerode, TypeORM, PostgreSQL, MinIO

## Project Structure

```
queueConsumer/
├── src/
│   ├── accessGroupExpiry/      # Access group expiration handling
│   │   └── access-group-expiry.provider.ts
│   ├── actions/                # Action execution system
│   │   ├── action-queue-processor.provider.ts    # Main action processor
│   │   ├── helper/            # Action-related helpers
│   │   │   ├── container-configs.ts       # Docker security configs
│   │   │   ├── disposable-api-key.ts      # Temporary API keys
│   │   │   ├── drive-helper.ts            # Google Drive integration
│   │   │   ├── hardware-dependency-error.ts
│   │   │   └── hardware-detect.ts         # GPU/CPU detection
│   │   └── services/
│   │       ├── action-manager.service.ts   # Action lifecycle management
│   │       ├── cleanup-containers.service.ts  # Container cleanup cron
│   │       └── docker-daemon.service.ts    # Docker API wrapper
│   ├── artifactUpload/         # Artifact upload to Drive (deprecated/unused)
│   ├── fileCleanup/            # File cleanup and synchronization
│   │   └── file-cleanup-queue-processor.provider.ts
│   ├── files/                  # File processing
│   │   ├── file-queue-processor.provider.ts  # Main file processor
│   │   └── helper/
│   │       ├── converter.ts           # bag→mcap conversion
│   │       ├── drive-helper.ts        # Google Drive download
│   │       ├── hash-helper.ts         # MD5 hash calculation
│   │       └── minio-helper.ts        # MinIO upload/download
│   ├── app.module.ts          # Root application module
│   ├── main.ts                # Application entry point
│   ├── logger.ts              # Winston logger
│   └── tracing.ts             # OpenTelemetry tracing
├── tsconfig.json
└── package.json

Key File: queueConsumer/src/app.module.ts:38-139
```

## Architecture

### Queue System

The queue consumer processes jobs from multiple Bull queues backed by Redis:

```
Redis (Bull)
  ├── file-queue                    # File processing jobs
  ├── action-queue-{hostname}       # Action jobs (per worker)
  ├── file-cleanup                  # File cleanup jobs
  └── move                          # File move operations
```

Each queue has dedicated processors that listen for jobs and execute them.

### Module Structure

```
AppModule
  ├── BullModule (Redis queues)
  ├── ConfigModule (Global)
  ├── TypeOrmModule (Database)
  ├── ScheduleModule (Cron jobs)
  └── Providers:
      ├── FileQueueProcessorProvider
      ├── ActionQueueProcessorProvider
      ├── FileCleanupQueueProcessorProvider
      ├── DockerDaemon
      ├── ActionManagerService
      ├── ContainerCleanupService
      └── AccessGroupExpiryProvider
```

## File Processing Pipeline

### 1. File Upload Flow

**Processor**: `FileQueueProcessorProvider` (queueConsumer/src/files/file-queue-processor.provider.ts)

```
Backend enqueues job → file-queue
  ↓
Queue Consumer picks up job
  ↓
Download from MinIO/Google Drive
  ↓
[IF bag file] Convert bag → mcap
  ↓
Extract topics & metadata from mcap
  ↓
Upload mcap to MinIO (if converted)
  ↓
Update database with file metadata
  ↓
Mark queue entry as COMPLETED
```

### Job Types

#### 1. `processMinioFile`
- **Trigger**: File uploaded directly to MinIO
- **Process**:
  1. Download file from MinIO
  2. If bag file and autoConvert enabled:
     - Convert to mcap using `mcap convert` CLI
     - Extract topics from mcap
     - Upload mcap to MinIO
     - Link bag ↔ mcap
  3. Update file state to OK
  4. Handle compression support (zstd)

Key File: queueConsumer/src/files/file-queue-processor.provider.ts:194-431

#### 2. `processDriveFile`
- **Trigger**: User provides Google Drive link
- **Process**:
  1. Fetch metadata from Google Drive
  2. If folder: recursively enqueue all bag/mcap files
  3. If file: download to temp location
  4. Process like MinIO file
  5. Upload to MinIO

Key File: queueConsumer/src/files/file-queue-processor.provider.ts:433-549

#### 3. `extractHashFromMinio`
- **Trigger**: File missing hash
- **Process**:
  1. Download file from MinIO
  2. Calculate MD5 hash
  3. Update database
  4. Delete temp file

Key File: queueConsumer/src/files/file-queue-processor.provider.ts:148-192

### File Conversion

**Converter**: `queueConsumer/src/files/helper/converter.ts`

```typescript
// bag → mcap conversion using mcap CLI
convertToMcap(tmpBagFile)
  → exec(`mcap convert ${infile} ${outfile}`)
  → returns tmpMcapFile

// Extract metadata from mcap
mcapMetaInfo(tmpMcapFile)
  → Uses @mcap/core McapIndexedReader
  → Returns { topics, date, size }
```

**Topics Extracted**:
- Topic name (e.g., `/camera/image_raw`)
- Message type (e.g., `sensor_msgs/Image`)
- Message count
- Message encoding
- Frequency (Hz)

Key File: queueConsumer/src/files/helper/converter.ts:1-91

### MinIO Operations

**Helper**: `queueConsumer/src/files/helper/minio-helper.ts`

- `uploadLocalFile()`: Upload file to MinIO bucket
- `downloadMinioFile()`: Download file and compute MD5 hash

Uses MinIO client with internal network connection (minio:9000).

Key File: queueConsumer/src/files/helper/minio-helper.ts:1-69

## Action Execution System

### Overview

Actions are Docker containers that run user-defined processing jobs on mission data. The system handles:
- Container lifecycle management
- Resource limits (CPU, memory, GPU, disk)
- Log capture and storage
- Artifact upload to Google Drive
- Worker assignment and health monitoring

### Action Execution Flow

```
Backend enqueues action → action-queue-{hostname}
  ↓
Worker picks up action
  ↓
Create temporary API key for container
  ↓
Pull Docker image (from rslethz/* only)
  ↓
Start container with resource limits
  ↓
Stream logs to database (batched every 100ms)
  ↓
Wait for container to finish
  ↓
Check exit code and set action state
  ↓
Launch artifact upload container
  ↓
Upload artifacts to Google Drive
  ↓
Delete API key and volumes
  ↓
Mark action as DONE or FAILED
```

### Action Queue Processor

**Processor**: `ActionQueueProcessorProvider` (queueConsumer/src/actions/action-queue-processor.provider.ts)

Key responsibilities:
- Register worker with hardware capabilities
- Process action jobs (concurrency: 1 per worker)
- Handle hardware dependency errors
- Retry jobs when requirements not met
- Update action state in database

**Worker Registration** (on startup):
- Detects CPU (cores, model, memory)
- Detects GPU (NVIDIA only, via /proc/driver/nvidia/gpus/)
- Detects disk space
- Creates/updates Worker entity in database
- Registers with hostname for distributed execution

Key File: queueConsumer/src/actions/action-queue-processor.provider.ts:39-252

### Action Manager Service

**Service**: `ActionManagerService` (queueConsumer/src/actions/services/action-manager.service.ts)

Core action processing logic:

#### 1. Create Disposable API Key
```typescript
createAPIkey(action)
  → Creates temporary API key
  → Scoped to action's mission
  → Type: CONTAINER (limited permissions)
  → Auto-deleted after action completes
```

Key File: queueConsumer/src/actions/services/action-manager.service.ts:46-71

#### 2. Start Container
```typescript
processAction(action)
  → startContainer(options)
    → Pull Docker image
    → Create container with:
      - Environment variables (API key, endpoints, UUIDs)
      - Resource limits (CPU, memory, GPU, runtime)
      - Volume mount (/out for artifacts)
      - Security restrictions
    → Start container
    → Set timeout to kill after maxRuntime
```

Container environment variables:
- `KLEINKRAM_API_KEY`: Temporary API key
- `KLEINKRAM_PROJECT_UUID`: Project UUID
- `KLEINKRAM_MISSION_UUID`: Mission UUID
- `KLEINKRAM_ACTION_UUID`: Action UUID
- `KLEINKRAM_API_ENDPOINT`: Backend URL
- `KLEINKRAM_S3_ENDPOINT`: MinIO URL

Key File: queueConsumer/src/actions/services/action-manager.service.ts:73-211

#### 3. Capture Logs
```typescript
subscribeToLogs(containerId, sanitize)
  → Observable<ContainerLog>
  → Buffers logs (100ms batches)
  → Writes to database in transactions
  → Sanitizes API keys from logs
  → Logs sent to Loki with labels
```

Key File: queueConsumer/src/actions/services/action-manager.service.ts:247-290

#### 4. Handle Exit Codes
```typescript
setActionState(container, action)
  → Exit 0: DONE
  → Exit 125: Container failed to run
  → Exit 137: Killed (OOM or CPU limit)
  → Exit 139: Segmentation fault
  → Exit 143: Terminated (timeout)
  → Other: FAILED
```

Key File: queueConsumer/src/actions/services/action-manager.service.ts:297-359

#### 5. Upload Artifacts
```typescript
launchArtifactUploadContainer(actionUuid, actionName)
  → Create Google Drive folder
  → Start artifact-uploader container
  → Mount same volume as action container
  → Upload all files from /out to Drive
  → Return Drive folder URL
```

Key File: queueConsumer/src/actions/services/action-manager.service.ts:455-557

### Docker Daemon Service

**Service**: `DockerDaemon` (queueConsumer/src/actions/services/docker-daemon.service.ts)

Low-level Docker operations:

```typescript
class DockerDaemon {
  docker: Dockerode  // Connected to /var/run/docker.sock

  // Container lifecycle
  startContainer(options) → { container, repoDigests, sha }
  stopContainer(id)
  killContainer(id)
  removeContainer(id, clearVolume)
  removeVolume(id)

  // Image management
  pullImage(dockerImage)  // Requires Docker Hub credentials
  getImage(dockerImage)   // Only allows rslethz/* images

  // Logging
  subscribeToLogs(id, sanitize) → Observable<ContainerLog>

  // Artifacts
  launchArtifactUploadContainer(id, name)
}
```

**Security Features**:
- Only rslethz/* Docker images allowed
- Container capabilities dropped (CAP_DROP)
- Security options enforced (no-new-privileges, seccomp)
- PID limit (1024)
- Network mode: bridge (isolated)
- Automatic container kill after maxRuntime

**Resource Limits**:
```typescript
defaultContainerLimitations = {
  max_runtime: 60 * 60 * 1000,      // 1 hour (ms)
  memory_limit: 1024 * 1024 * 1024, // 1 GB (bytes)
  n_cpu: 2,                          // 2 cores
  disk_quota: 40_737_418_240,        // ~38 GB (bytes)
}
```

Templates can override these limits.

Key File: queueConsumer/src/actions/services/docker-daemon.service.ts:72-558

### Container Cleanup

**Service**: `ContainerCleanupService` (queueConsumer/src/actions/services/cleanup-containers.service.ts)

Runs every 30 seconds to clean up:
- Orphaned containers (no corresponding action in DB)
- Crashed containers (action in PROCESSING but container not running)
- Old containers (>24 hours running)
- Completed action containers still running

Key File: queueConsumer/src/actions/services/cleanup-containers.service.ts:1-16
Key File: queueConsumer/src/actions/services/action-manager.service.ts:365-487

## File Cleanup & Maintenance

### File Cleanup Queue Processor

**Processor**: `FileCleanupQueueProcessorProvider` (queueConsumer/src/fileCleanup/file-cleanup-queue-processor.provider.ts)

#### 1. Cancel Upload
- **Job**: `cancelUpload`
- **Trigger**: User cancels upload
- **Process**:
  1. Check user permissions
  2. Find files in UPLOADING state
  3. Mark queue as CANCELED
  4. Delete file entities

Key File: queueConsumer/src/fileCleanup/file-cleanup-queue-processor.provider.ts:73-118

#### 2. Cron Jobs

##### Fix File Hashes (Daily at 3 AM)
- Finds files with missing hashes
- Downloads from MinIO
- Calculates MD5 hash
- Updates database
- Uses Redlock for distributed locking

Key File: queueConsumer/src/fileCleanup/file-cleanup-queue-processor.provider.ts:120-176

##### Cleanup Failed Uploads (Daily at 1 AM)
- Finds files stuck in UPLOADING >12 hours
- Marks as ERROR
- Updates corresponding queue entries

Key File: queueConsumer/src/fileCleanup/file-cleanup-queue-processor.provider.ts:178-237

##### Create File Name Dump (Daily at 1 AM)
- Exports CSV of all files (bag and mcap)
- Format: filename, uuid, mission, project, uuids
- Stored in MinIO as `file_names.csv`

Key File: queueConsumer/src/fileCleanup/file-cleanup-queue-processor.provider.ts:282-286

##### Synchronize File System (Daily at 2 AM)
- Checks all OK/FOUND files exist in MinIO
- Marks missing files as LOST
- Checks if LOST files have been restored
- Finds files in MinIO not in database:
  - Reads MinIO object tags
  - Creates queue entry for recovery
  - Marks as recovering job
- Uses Redlock for distributed locking

Key File: queueConsumer/src/fileCleanup/file-cleanup-queue-processor.provider.ts:288-451

## Access Group Expiry

**Provider**: `AccessGroupExpiryProvider` (queueConsumer/src/accessGroupExpiry/access-group-expiry.provider.ts)

**Cron**: Every 4 hours

- Soft-deletes expired group memberships
- Uses Redlock for distributed locking

Key File: queueConsumer/src/accessGroupExpiry/access-group-expiry.provider.ts:1-38

## Hardware Detection

**Helper**: `hardware-detect.ts` (queueConsumer/src/actions/helper/hardware-detect.ts)

Detects worker capabilities:

```typescript
createWorker(workerRepository)
  → CPU: systeminformation.cpu() → { cores, model, memory }
  → GPU: /proc/driver/nvidia/gpus/*/information
  → Disk: systeminformation.fsSize() → available space
  → Hostname: Docker info.Name
  → Creates Worker entity
```

**GPU Detection**:
- Checks Docker has nvidia runtime
- Reads /proc/driver/nvidia/gpus/ directory
- Extracts model from information file
- Returns empty array if no GPU

Key File: queueConsumer/src/actions/helper/hardware-detect.ts:1-127

## Distributed Locking

Uses **Redlock** (Redis-based distributed lock) for:
- File hash repair
- Failed upload cleanup
- File system synchronization
- Access group expiry

Prevents multiple workers from running the same cron job simultaneously.

```typescript
this.redlock.using([`lock:hash-repair`], 10_000, async () => {
  // Critical section
})
```

## Observability

### Logging

Winston logger with:
- Structured logging
- Loki integration (if configured)
- Container logs tagged with action_uuid and container_id

### Tracing

OpenTelemetry spans for:
- File processing operations
- Action execution
- Container operations
- MinIO operations
- Conversion operations

Custom `@tracing()` decorator for automatic instrumentation.

Key File: queueConsumer/src/tracing.ts

### Metrics

Prometheus metrics for:
- Job processing rates
- Job failures
- Processing duration

## Environment Configuration

Key environment variables:
- **Redis**: redis:6379 (hardcoded)
- **Database**: Same as backend (via @common/environment)
- **MinIO**: Internal endpoint (minio:9000)
- **Docker**: Unix socket (/var/run/docker.sock)
- **Google Drive**:
  - `GOOGLE_KEY_FILE`: Service account key
  - `GOOGLE_ARTIFACT_FOLDER_ID`: Root folder for artifacts
  - `GOOGLE_ARTIFACT_UPLOADER_KEY_FILE`: Uploader key
- **Docker Hub**:
  - `DOCKER_HUB_USERNAME`
  - `DOCKER_HUB_PASSWORD`

## Error Handling

### Action Errors

1. **HardwareDependencyError**: Worker doesn't meet requirements
   - Retries job (up to max attempts)
   - Marks action as PENDING
   - Another worker may pick it up

2. **Unexpected Errors**: Container crashes, Docker issues, etc.
   - Marks action as FAILED
   - Records error message in state_cause
   - Removes job from queue

Key File: queueConsumer/src/actions/action-queue-processor.provider.ts:124-206

### File Processing Errors

- **Conversion Error**: bag→mcap fails
  - Marks queue as CORRUPTED
  - Marks file as CONVERSION_ERROR
  - Cleans up temp files

- **Upload Error**: MinIO upload fails
  - Marks queue as ERROR
  - Marks file as ERROR
  - Retries or fails

## Common Development Tasks

### Adding a New Queue

1. Register queue in BullModule (app.module.ts)
2. Create processor provider
3. Decorate with `@Processor('queue-name')`
4. Implement `@Process()` method
5. Add to providers array in AppModule

### Adding a New Cron Job

1. Create service or add to existing provider
2. Use `@Cron()` decorator with schedule
3. Consider using Redlock for distributed systems
4. Add error handling

### Debugging Actions

1. Check action logs in database (Action.logs)
2. Check container logs: `docker logs <container-id>`
3. Check OpenTelemetry traces
4. Verify worker has required hardware
5. Check Docker socket permissions

### Testing File Processing

1. Upload file via backend
2. Check queue entry state
3. Check queue consumer logs
4. Verify file in MinIO
5. Check file state in database
6. Verify topics extracted (for mcap)

## Important Patterns

### 1. Temporary Files
Always clean up temporary files in try/finally blocks:
```typescript
job.data.tmp_files.push(temporaryFileName);
// ... processing
await this.deleteTmpFiles(job);
```

### 2. Job Data
Store cleanup data in job.data for use in onCompleted/onFailed hooks.

### 3. Transactions
Use transactions for atomic database updates:
```typescript
await this.repository.manager.transaction(async (manager) => {
  // Multiple DB operations
});
```

### 4. Redlock
Always use Redlock for cron jobs in distributed systems.

### 5. API Key Cleanup
Use Symbol.asyncDispose for automatic cleanup:
```typescript
await using apikey = await this.createAPIkey(action);
// Automatically deleted when scope exits
```

## Related Documentation

- [Root AGENTS.md](../AGENTS.md) - System overview
- [Backend AGENTS.md](../backend/AGENTS.md) - Job submission
- [Common AGENTS.md](../common/AGENTS.md) - Shared entities

## Testing

Run tests:
```bash
yarn test
```

Most testing requires:
- Redis running locally
- PostgreSQL with test data
- MinIO accessible
- Docker socket accessible

## Performance Considerations

- File conversion is CPU-intensive (single-threaded)
- Topic extraction requires reading entire mcap file
- MinIO downloads can be slow for large files
- Actions run with concurrency: 1 (sequential per worker)
- File processing has no concurrency limit (parallel)
- Use Redlock timeouts appropriately (10s default)
