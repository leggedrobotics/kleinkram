#!/bin/bash

set -e # exit on error

env
echo ""
echo ""
echo "List files of mission with UUID $MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint set $ENDPOINT
klein login --key $APIKEY
klein mission byUUID $MISSION_UUID

# TODO... this Endpoint needs to be fixed
klein mission download --mission-uuid $MISSION_UUID /out

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./out || exit 1
ls -la

echo ""
echo "generate 10 lines of fake log messages"
echo ""
for i in {1..10}; do
  echo "log message $i"
  echo "✤ Rocket" 1>&2
done

exit 0
