#!/bin/sh

env
echo ""
echo ""
echo "List files of mission with UUID $MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint set $ENDPOINT
klein login --key $APIKEY
klein list files -m $MISSION_UUID

# TODO... this Endpoint needs to be fixed
mkdir data
klein download -m $MISSION_UUID --dest ./data

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la

# compute 'SHA-256' hash of ./data/test_small.bag
sha256sum ./test_small.bag

exit 0
