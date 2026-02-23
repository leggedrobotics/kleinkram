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
          "accessKey": "${S3_ACCESS_KEY}",
          "secretKey": "${S3_SECRET_KEY}"
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
/usr/bin/weed server -dir=/data -s3 -s3.port=9000 -s3.config=/etc/seaweedfs/s3.json -ip.bind=0.0.0.0 -s3.ip.bind=0.0.0.0 -metricsPort=9324 &

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

create_bucket() {
  local bucket_name=$1
  echo "Creating bucket: ${bucket_name}"

  # Perform request, capture output and HTTP code
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "http://127.0.0.1:8888/buckets/${bucket_name}/")

  # Extract HTTP code (last line) and body
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
    echo "-> Bucket ${bucket_name} created successfully."
  elif [ "$http_code" = "409" ] || echo "$body" | grep -q 'already exists'; then
    echo "-> Bucket ${bucket_name} already exists."
  else
    echo "-> WARNING: Failed to create bucket ${bucket_name}. HTTP Status: ${http_code}. Response: $body"
  fi
}

# S3 Buckets are mounted as directories inside SeaweedFS's Filer under /buckets/
create_bucket "${S3_DATA_BUCKET_NAME:-data}"
create_bucket "${S3_DB_BUCKET_NAME:-dbdumps}"
create_bucket "${S3_ARTIFACTS_BUCKET_NAME:-action-artifacts}"

echo "Configuring Bucket TTL..."
# Apply a 90-day TTL to the action-artifacts bucket so all objects inside inherit it
echo "fs.configure -locationPrefix=/buckets/${S3_ARTIFACTS_BUCKET_NAME:-action-artifacts}/ -ttl=90d -apply" | /usr/bin/weed shell -master=127.0.0.1:9333 || true

echo "SeaweedFS is ready!"

# 5. Keep the container running
wait
