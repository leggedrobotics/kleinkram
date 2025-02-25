#!/bin/bash

set -e # exit on error

env
echo ""
echo ""
echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint server $KLEINKRAM_API_ENDPOINT $KLEINKRAM_S3_ENDPOINT
klein login --key $KLEINKRAM_API_KEY

klein --version

# TODO... this Endpoint needs to be fixed
klein list files -m $KLEINKRAM_MISSION_UUID
klein download -m $KLEINKRAM_MISSION_UUID --dest /out

echo ""
echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
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
