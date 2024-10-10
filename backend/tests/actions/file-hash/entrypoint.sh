#!/bin/sh

# the following command is necessary as we didn't installed the package,
# instead we are running it from the source code
alias klein='python ./cli/src/klein.py'


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
klein mission download --mission-uuid $MISSION_UUID ./data

echo ""
echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la

# compute 'SHA-256' hash of ./data/test_small.bag
sha256sum ./test_small.bag

exit 0
