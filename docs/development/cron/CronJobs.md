# Cron Jobs

Cron jobs are recurring tasks used for database cleanup, synchronization, and system maintenance.

Most jobs run on the Queue Consumer service. Because this service can have multiple replicas, any job running there must
use Redlock to ensure it only runs on one instance at a time. Jobs on the Backend run as a single instance and do not
require a lock.

## Jobs Inventory

| When      | Name                     | Location       | Description                                                                                                                                                                                                                                             |
| --------- | ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily 1AM | Failed Uploads           | Queue Consumer | If a file is in the state Uploading for more than 12h, it, and its corresponding Queue Entry is considered Failed. See [Multipart Upload Lifecycles](#multipart-upload-lifecycles).                                                                     |
| Daily 2AM | Synchronize FS           | Queue Consumer | Check that every entry in S3 exists in the DB and Vice Versa.                                                                                                                                                                                           |
| Daily 3AM | Fix File Hashes          | Queue Consumer | Calculate File Hash for every file that doesn't have one.                                                                                                                                                                                               |
| Every Min | Worker Healthcheck       | Queue Consumer | Every Queue Consumer reports that it is alive and thus can process Jobs.                                                                                                                                                                                |
| Every 30s | Container Cleanup        | Queue Consumer | Check if containers have crashed or should be killed. Updates the DB                                                                                                                                                                                    |
| Every 30s | API Health Check         | Backend        | Check which Queue Consumer have checked in within the last 2min. All others are set to unreachable and no longer receive Jobs. Their jobs are rescheduled.                                                                                              |
| Every 4h  | Check Group Access       | Queue Consumer | Soft-deletes any GroupMembership where the expirationDate has passed.                                                                                                                                                                                   |
| Hourly    | Recording Times Backfill | Queue Consumer | Queues up to 1,000 recordings without a recording start for a read of their index.                                                                                                                                                                      |
| Hourly    | Topic Stats Backfill     | Queue Consumer | Off unless `TOPIC_STATS_BACKFILL=true`. Queues up to 1,000 files whose `topicStatsVersion` is below `TOPIC_STATS_VERSION` to compute per-topic first/last seen, chunk count, coverage and frequency. See [Topic Stats Backfill](#topic-stats-backfill). |

### Multipart Upload Lifecycles

Note that the `Failed Uploads` job only marks the database entries as failed. The actual file chunks (incomplete
multipart uploads) residing in S3 are automatically aborted and deleted after 1 day via S3 bucket lifecycle rules that
are applied on application startup.

### Topic Stats Backfill

Every topic stores where in its file it has data: `firstSeen`, `lastSeen`, `chunkCount`, `coverage` (spans in
milliseconds since the recording start) and a `frequency` over its own span rather than the whole recording (null for a topic without a rate: a single message, a zero span, or, in a file of at least 5 chunks, a one-shot topic seen in fewer than 5). Ingestion
writes these for new files. The backfill computes them for older files from the file's own index, without reading any
message:

- MCAP: the chunk indexes in the summary section, read with range requests.
- ROS 1 bag: the chunk info records in the index at the end of the file, read with range requests.
- db3: nothing to read; the file only gets the version.

A file gets the current version whether or not its index could be read, so it is never retried. Raising
`TOPIC_STATS_VERSION` (in `packages/backend-common/src/services/topic-stats-backfill.ts`) makes the backfill recompute
every file. The job writes only its own columns and leaves `updatedAt` alone, so running it twice on a file is
harmless.

The cron is off by default. Enable it per deployment with `TOPIC_STATS_BACKFILL=true` in the queue consumer's
environment.
