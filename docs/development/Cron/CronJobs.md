# Cron

Chron jobs are recurring tasks required to clean up the database and perform other maintenance tasks. 
The following is a list of the chron jobs that are currently running on the server.
They should be, if possible, run on the queue consumer server. But as this server might be replicated, redlock is 
used to ensure that the cron jobs are only run once.

## Jobs

| When        | Name               | Location       | Description                                                                                                                                                |
|-------------|--------------------|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Daily 1AM   | Failed Uploads     | Queue Consumer | If a file is in the state Uploading for more than 12h, it, and its corresponding Queue Entry is considered Failed.                                         |
| Daily 2AM   | Synchronize FS     | Queue Consumer | Check that every entry in Minio exists in the DB and Vice Versa.                                                                                           |
| Daily 3AM   | Fix File Hashes    | Queue Consumer | Calculate File Hash for every file that doesn't have one.                                                                                                  |
| Every Min   | Worker Healthcheck | Queue Consumer | Every Queue Consumer reports that it is alive and thus can process Jobs.                                                                                   |
| Every 30s   | Container Cleanup  | Queue Consumer | Check if containers have crashed or should be killed. Updates the DB                                                                                       |
| Every 2nd H | DB Dump            | Backend        | Generate Database dump and upload it to Minio                                                                                                              |
| Every 30s   | API Health Check   | Backend        | Check which Queue Consumer have checked in within the last 2min. All others are set to unreachable and no longer receive Jobs. Their jobs are rescheduled. |        