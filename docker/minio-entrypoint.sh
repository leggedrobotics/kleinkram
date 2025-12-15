#!/bin/sh
set -e

# 1. Start MinIO in the background
echo "Starting MinIO server..."
mkdir -p /data
/usr/bin/minio server --console-address ':9001' /data &

# 2. Wait for the server to be actually ready (Healthcheck Loop)
echo "Waiting for MinIO to startup..."
timeout=30
while ! curl -s http://127.0.0.1:9000/minio/health/live > /dev/null; do
  if [ $timeout -le 0 ]; then echo "MinIO failed to start"; exit 1; fi
  echo "MinIO not ready yet, retrying..."
  sleep 1
  timeout=$((timeout - 1))
done

# 3. Configure the alias (using ROOT credentials)
# We use 127.0.0.1 to avoid Docker DNS resolution issues inside the container
echo "Configuring MinIO alias..."
mc alias set myminio http://127.0.0.1:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

# 4. Create Buckets
echo "Creating buckets..."
mc mb myminio/${MINIO_DATA_BUCKET_NAME} --ignore-existing
mc mb myminio/${MINIO_DB_BUCKET_NAME} --ignore-existing
mc mb myminio/${MINIO_ARTIFACTS_BUCKET_NAME} --ignore-existing

# 5. Set Lifecycle Rules (ILM)
echo "Setting lifecycle rules..."
mc ilm rule add myminio/${MINIO_ARTIFACTS_BUCKET_NAME} --expire-days 90 || true

# 6. Create Service Account
# Notes:
# - We attach this to MINIO_ROOT_USER so it inherits Admin/ReadWrite permissions automatically.
# - We removed '--policy readwrite' because that flag expects a JSON file path, not a name.
echo "Creating service account..."
mc admin user svcacct add myminio "${MINIO_ROOT_USER}" \
  --access-key "${MINIO_ACCESS_KEY}" \
  --secret-key "${MINIO_SECRET_KEY}" \
  || true

echo "MinIO is ready!"

# 7. Keep the container running
wait
