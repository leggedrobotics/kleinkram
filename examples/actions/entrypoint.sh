#!/bin/sh

env
echo ""
echo ""
echo "List files of mission with UUID $MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint set http://localhost:3000
klein login --key $APIKEY
klein mission byUUID $MISSION_UUID

# TODO... this Endpoint needs to be fixed
mkdir data
klein mission download $MISSION_UUID ./data

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la

exit 0
