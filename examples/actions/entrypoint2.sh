#!/bin/bash

set -e # exit on error

env
echo "WOW: entrypoint2.sh"
echo ""
echo "List files of mission with UUID $MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein endpoint set $ENDPOINT
klein login --key $APIKEY

klein --version

# TODO... this Endpoint needs to be fixed
klein download -m $MISSION_UUID --dest /out

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./out || exit 1
ls -la


exit 0
