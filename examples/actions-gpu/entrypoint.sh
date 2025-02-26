#!/bin/sh

set -e # exit on error

env
echo ""
echo ""

nvidia-smi

echo ""
echo ""
echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint server $KLEINKRAM_API_ENDPOINT $KLEINKRAM_S3_ENDPOINT
klein login --key $KLEINKRAM_API_KEY
klein --version
klein list files $KLEINKRAM_MISSION_UUID

# TODO... this Endpoint needs to be fixed
mkdir data
klein download -m $KLEINKRAM_MISSION_UUID --dest ./data

echo ""
echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
cd ./data || exit 1
ls -la

exit 0
