#!/bin/sh

env
echo ""
echo ""
echo "List files of mission with UUID $MISSION_UUID"
echo ""

# print rocket emoji
echo "🚀 Rocket"

klein setendpoint http://localhost:3000
klein login --key $APIKEY
klein mission byUUID $MISSION_UUID

# TODO... this Endpoint needs to be fixed
klein file download $MISSION_UUID

# wait forever
# tail -f /dev/null

exit 0