#!/bin/bash
set -e

echo "Validating data for mission $KLEINKRAM_MISSION_UUID"
klein --version

# Authenticate
klein login --key "$KLEINKRAM_API_KEY"

# Download data
mkdir /data
klein download -m "$KLEINKRAM_MISSION_UUID" --dest /data

# Calculate hashes
cd /data
find . -type f -exec sha256sum {} \; > /out/checksums.txt

echo "Validation complete. Checksums saved to checksums.txt"
