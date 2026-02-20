#!/bin/sh
set -e

# 1. Create S3 Configuration
echo "Configuring SeaweedFS S3 API authentication..."
mkdir -p /etc/seaweedfs
cat <<EOF > /etc/seaweedfs/s3.json
{
  "identities": [
    {
      "name": "kleinkram-backend",
      "credentials": [
        {
          "accessKey": "${S3_ACCESS_KEY:-S3_ACCESS_KEY}",
          "secretKey": "${S3_SECRET_KEY:-S3_SECRET_KEY}"
        }
      ],
      "actions": [
        "Admin",
        "Read",
        "Write",
        "List",
        "Tagging"
      ]
    }
  ]
}
EOF

# 2. Start SeaweedFS in the background
echo "Starting SeaweedFS server..."
mkdir -p /data
/usr/bin/weed server -dir=/data -s3 -s3.port=9000 -s3.config=/etc/seaweedfs/s3.json -ip.bind=0.0.0.0 -s3.ip.bind=0.0.0.0 &

# 3. Wait for the server to be actually ready (Healthcheck Loop)
echo "Waiting for SeaweedFS Master to startup..."
timeout=30
while ! curl -s http://127.0.0.1:9333/cluster/status > /dev/null; do
  if [ $timeout -le 0 ]; then echo "SeaweedFS Master failed to start"; exit 1; fi
  echo "SeaweedFS Master not ready yet, retrying..."
  sleep 1
  timeout=$((timeout - 1))
done

echo "Waiting for SeaweedFS S3 to startup..."
timeout=30
while ! curl -s http://127.0.0.1:9000/ > /dev/null; do
  if [ $timeout -le 0 ]; then echo "SeaweedFS S3 failed to start"; exit 1; fi
  echo "SeaweedFS S3 not ready yet, retrying..."
  sleep 1
  timeout=$((timeout - 1))
done

# 4. Create Buckets
echo "Creating buckets via Filer..."
# S3 Buckets are mounted as directories inside SeaweedFS's Filer under /buckets/
curl -X POST "http://127.0.0.1:8888/buckets/${S3_DATA_BUCKET_NAME:-data}/" || true
curl -X POST "http://127.0.0.1:8888/buckets/${S3_DB_BUCKET_NAME:-dbdumps}/" || true
curl -X POST "http://127.0.0.1:8888/buckets/${S3_ARTIFACTS_BUCKET_NAME:-action-artifacts}/" || true

echo "SeaweedFS is ready!"

# 5. Keep the container running
wait
