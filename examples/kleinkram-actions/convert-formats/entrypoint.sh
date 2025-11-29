#!/bin/bash
set -e

echo "Converting formats for mission $KLEINKRAM_MISSION_UUID"

# Authenticate
klein login --key "$KLEINKRAM_API_KEY"

# Download data
mkdir /data
klein download -m "$KLEINKRAM_MISSION_UUID" --dest /data

# Convert formats
python3 /convert.py /data /out

echo "Format conversion complete."
