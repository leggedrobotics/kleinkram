# Cron Jobs

Cron jobs are recurring tasks used for database cleanup, synchronization, and system maintenance.

Most jobs run on the Queue Consumer service. Because this service can have multiple replicas, any job running there must
use Redlock to ensure it only runs on one instance at a time. Jobs on the Backend run as a single instance and do not
require a lock.

## Jobs Inventory

| When        | Name               | Location       | Description                                                                                                                                                                         |
| ----------- | ------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily 1AM   | Failed Uploads     | Queue Consumer | If a file is in the state Uploading for more than 12h, it, and its corresponding Queue Entry is considered Failed. See [Multipart Upload Lifecycles](#multipart-upload-lifecycles). |
| Daily 2AM   | Synchronize FS     | Queue Consumer | Check that every entry in S3 exists in the DB and Vice Versa.                                                                                                                       |
| Daily 3AM   | Fix File Hashes    | Queue Consumer | Calculate File Hash for every file that doesn't have one.                                                                                                                           |
| Every Min   | Worker Healthcheck | Queue Consumer | Every Queue Consumer reports that it is alive and thus can process Jobs.                                                                                                            |
| Every 30s   | Container Cleanup  | Queue Consumer | Check if containers have crashed or should be killed. Updates the DB                                                                                                                |
| Every 2nd H | DB Dump            | Backend        | Generate Database dump and upload it to S3                                                                                                                                          |
| Every 30s   | API Health Check   | Backend        | Check which Queue Consumer have checked in within the last 2min. All others are set to unreachable and no longer receive Jobs. Their jobs are rescheduled.                          |
| Every 4h    | Check Group Access | Queue Consumer | Soft-deletes any GroupMembership where the expirationDate has passed.                                                                                                               |

### Multipart Upload Lifecycles

Note that the `Failed Uploads` job only marks the database entries as failed. The actual file chunks (incomplete
multipart uploads) residing in S3 are automatically aborted and deleted after 1 day via S3 bucket lifecycle rules that
are applied on application startup.
