# Minio File Storage

Minio is a high-performance object storage. It is used to store files. The API should never handle files directly. These
files can be too large and slow down the API. Instead, the API should use presigned URLs to Minio so that files are
directly uploaded to & downloaded from Minio.

In minio are two buckets: one for `.bag` files and one for `.mcap` files. The files are grouped by their Project and
Mission.