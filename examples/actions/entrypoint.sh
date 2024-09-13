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
mkdir data
klein mission download $MISSION_UUID ./data

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la

echo ""
echo "generate 1_000 lines of fake log messages"
echo ""
for i in {1..10}; do
  echo "log message $i"
  echo "🚀 Rocket" 1>&2
done

sleep 5

exit 0
