#!/bin/sh
if [ "$DEVBUILD" = "true" ]; then
  echo "Development Build"
  npm run gen:docs /app/docs/development/api/generated &
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

  echo "----------------------------------------"
  echo "Backend API ready on http://localhost:3000"
  echo "----------------------------------------"

else
  echo "Production Build"
  node dist/main.js &
fi

tail -f /dev/null
