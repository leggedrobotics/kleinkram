#!/bin/sh
echo "Start Backend"
if [ "$DEVBUILD" = "true" ]; then
  echo "Development Build"
  pnpm start:dev &
  sleep 10

  # Only try to access packages/seed in development where the volume is mounted
  cd ../packages/backend-common || echo "Could not find backend-common, skipping seed"

  if [ "$SEED" = "true" ]; then
    echo "Seeding Database"
    pnpm seed:run
  else
    echo "Not Seeding Database"
  fi
else
  echo "Production Build"
  node dist/main.js &
fi

tail -f /dev/null
