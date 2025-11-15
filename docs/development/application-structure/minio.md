# Minio File Storage

Minio is a high-performance object storage. It is used to store files. The API should never handle files directly. These
files can be too large and slow down the API. Instead, the API should issue temporary credentials for Minio so that
files are directly uploaded to & downloaded from Minio.

In minio are two buckets:

- `data` containing all mission files (e.g. `.bag`, `.mcap`, etc.)
- `artifacts` containing kleinkram action artifacts
- `dbdump` contains database dumps (of postgres).

## File Storage Structure

### Data Bucket

All files stored inside the `data` bucket use their UUID as the file name. The UUID matches the primary key of the
corresponding database entry. Additionally, files have the following tags:

- `filename`: the original file name
- `missionUuid`: the UUID of the mission this file belongs to
- `projectUuid`: the UUID of the project this file belongs to

We store these metadata as tags and not as object metadata, because tags can be modified after the object
creation, while object metadata cannot.

### Dbdump Bucket

Database dumps are stored inside the `dbdump` bucket. We create a DB dump every other hour. The file name is the
timestamp of the dump creation in the format `backup-<milliseconds-since-epoch>.sql` (e.g. `backup-1726488000009.sql`).

### Kleinkram Artifacts Bucket

Kleinkram action artifacts are stored inside the `artifacts` bucket. The file name is the action UUID.

## Accessing the Minio Console

For development purposes, you can access the Minio console at `http://localhost:9001`. The default credentials are:

- Username: `minioadmin`
- Password: `minioadmin`
