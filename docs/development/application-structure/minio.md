# Minio File Storage

Minio is a high-performance object storage. It is used to store files. The API should never handle files directly. These
files can be too large and slow down the API. Instead, the API should issue temporary credentials for Minio so that
files are directly uploaded to & downloaded from Minio.

In minio are three buckets:

- one for `.bag` files,
- one for `.mcap` files
- one for `.dump` files for database backups.

The files are saved under their UUID. Additional metadata is attached as tages, this includes the filename, the
corresponding `missionUuid` and `projectUuid` as metadata.
