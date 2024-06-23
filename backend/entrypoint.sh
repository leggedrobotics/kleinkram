#!/bin/sh

echo "Start Backend"
yarn start:dev &

sleep 5
echo "Seed Database"
cd ../common
yarn seed:run
echo "Database Seeded"

tail -f /dev/null