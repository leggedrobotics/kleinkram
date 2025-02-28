#!/bin/bash

set -e # exit on error

env
echo "WOW: entrypoint2.sh"
echo ""
echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint server $KLEINKRAM_API_ENDPOINT $KLEINKRAM_S3_ENDPOINT
klein login --key $KLEINKRAM_API_KEY

klein --version

# TODO... this Endpoint needs to be fixed
klein download -m $KLEINKRAM_MISSION_UUID --dest /out

echo ""
echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
cd ./out || exit 1
ls -la


exit 0
