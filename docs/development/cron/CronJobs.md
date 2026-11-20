# Cron Jobs

Cron jobs are recurring tasks used for database cleanup, synchronization, and system maintenance.

Most jobs run on the Queue Consumer service. Because this service can have multiple replicas, any job running there must
use Redlock to ensure it only runs on one instance at a time. Jobs on the Backend run as a single instance and do not
require a lock.

## Jobs Inventory

| When      | Name                     | Location                | Description                                                                                                                                                                         |
| --------- | ------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily 1AM | Failed Uploads           | Queue Consumer          | If a file is in the state Uploading for more than 12h, it, and its corresponding Queue Entry is considered Failed. See [Multipart Upload Lifecycles](#multipart-upload-lifecycles). |
| Daily 3AM | Fix File Hashes          | Queue Consumer          | Calculate File Hash for every file that doesn't have one.                                                                                                                           |
| Daily 3AM | Delete Ended Sessions    | Backend                 | Deletes login sessions that ended (revoked, expired or idle) more than 30 days ago.                                                                                                 |
| Every 4h  | Check Group Access       | Queue Consumer          | Soft-deletes any GroupMembership where the expirationDate has passed.                                                                                                               |
| Every 1h  | Recording Times Backfill | Queue Consumer          | Looks for the recording start and end of files that don't have them yet.                                                                                                            |
| Every Min | Worker Healthcheck       | Queue Consumer          | Every Queue Consumer reports that it is alive and thus can process Jobs.                                                                                                            |
| Every Min | Time Triggers            | Backend                 | Queues a check of the cron expressions of all time schedule triggers; the Queue Consumer starts the due actions.                                                                    |
| Every 30s | Container Cleanup        | Queue Consumer          | Check if containers have crashed or should be killed. Updates the DB                                                                                                                |
| Every 30s | API Health Check         | Backend, Queue Consumer | Check which Queue Consumer have checked in within the last 2min. All others are set to unreachable and no longer receive Jobs. Their jobs are rescheduled.                          |
| Every 10s | Loki Health              | Backend, Queue Consumer | Probes Loki. Launching an action is refused while Loki is not ready, because its logs would be lost.                                                                                |
| Every 1s  | Queue Metrics            | Backend, Queue Consumer | Updates the Prometheus metrics of the file and action queues.                                                                                                                       |

The jobs in `packages/backend-common` (API Health Check, Loki Health, Queue Metrics of the action queues) run in every
service that loads their module.

### Multipart Upload Lifecycles

Note that the `Failed Uploads` job only marks the database entries as failed. The actual file chunks (incomplete
multipart uploads) residing in S3 are automatically aborted and deleted after 1 day via S3 bucket lifecycle rules that
are applied on application startup.
