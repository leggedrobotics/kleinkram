#!/bin/bash
set -e

CHECK_MODE=false
if [ "$1" == "--check" ]; then
  CHECK_MODE=true
  MIGRATION_NAME="ci_check_$(date +%s)"
else
  MIGRATION_NAME=$1
fi

if [ -z "$MIGRATION_NAME" ]; then
  echo "Error: Migration name is required."
  echo "Usage: pnpm run migration:generate:clean <migration-name>"
  echo "       pnpm run migration:check"
  exit 1
fi

echo "🚀 Starting clean migration generation for '$MIGRATION_NAME'..."

# 1. Start a temporary Postgres container
CONTAINER_NAME="temp-migration-db-$(date +%s)"
echo "📦 Starting temporary Postgres container: $CONTAINER_NAME"
# Use -p 0:5432 to let Docker assign a random ephemeral port
docker run --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=temp_password -p 0:5432 -d postgres:17 > /dev/null

# Ensure cleanup happens on exit
cleanup() {
  echo "🧹 Cleaning up..."
  docker rm -f "$CONTAINER_NAME" > /dev/null
}
trap cleanup EXIT

# 2. Wait for DB to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Get the assigned random port
DB_PORT=$(docker port "$CONTAINER_NAME" 5432 | awk -F: '{print $2}')
echo "🔌 Temporary DB running on port: $DB_PORT"

# 3. Export connection details
export dev_dbhost=localhost
export dev_port=$DB_PORT
export dev_dbuser=postgres
export dev_dbpassword=temp_password
export dev_dbname=postgres
export dev_ssl=false

# 4. Run existing migrations
echo "🔄 Running existing migrations..."
pnpm run typeorm migration:run -d migration/dev/migration.config.ts > /dev/null

# 5. Generate the new migration
# 5. Generate the new migration
echo "📝 Generating new migration..."
set +e
OUTPUT=$(pnpm run typeorm migration:generate "migration/migrations/$MIGRATION_NAME" -d migration/dev/migration.config.ts 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
  if echo "$OUTPUT" | grep -q "No changes in database schema were found"; then
    echo "⚠️  No changes in database schema were found."
    if [ "$CHECK_MODE" = true ]; then
      echo "✅ Check passed: Migrations are up to date."
      exit 0
    else
      echo "No migration generated."
      exit 1
    fi
  else
    echo "❌ Migration generation failed:"
    echo "$OUTPUT"
    exit $EXIT_CODE
  fi
else
  if [ "$CHECK_MODE" = true ]; then
    echo "❌ Check failed: A new migration was generated."
    echo "This means the committed migrations are not in sync with the entities."
    echo "Please run 'pnpm run migration:generate:clean <name>' and commit the result."
    exit 1
  else
    echo "$OUTPUT"
    echo "✅ Migration generation complete!"
  fi
fi
