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

klein --version

# TODO... this Endpoint needs to be fixed
klein mission download --mission-uuid $MISSION_UUID --local-path /out

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./out || exit 1
ls -la


exit 0
