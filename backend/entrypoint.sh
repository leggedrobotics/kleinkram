#!/bin/sh

echo "Start Backend"
yarn start:dev &

sleep 5
cd ../common

if [ "$SEED" = "true" ]; then
  echo "Seeding Database"
  yarn seed:run
else
  echo "Not Seeding Database"
  tail -f /dev/null
fi

tail -f /dev/null