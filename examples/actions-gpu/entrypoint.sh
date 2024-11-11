#!/bin/sh

set -e # exit on error

env
echo ""
echo ""

nvidia-smi

echo ""
echo ""
echo "List files of mission with UUID $MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint set $ENDPOINT
klein login --key $APIKEY
klein --version
klein list files $MISSION_UUID

# TODO... this Endpoint needs to be fixed
mkdir data
klein download -m $MISSION_UUID --dest ./data

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la

exit 0
