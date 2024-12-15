#!/bin/sh
echo "Start Backend"
if [ "$DEVBUILD" = "true" ]; then
  echo "Development Build"
  yarn start:dev &
else
  echo "Production Build"
  yarn start:prod &
fi

sleep 10
cd ../common

if [ "$SEED" = "true" ]; then
  echo "Seeding Database"
  yarn seed:run
else
  echo "Not Seeding Database"
  tail -f /dev/null
fi

tail -f /dev/null
