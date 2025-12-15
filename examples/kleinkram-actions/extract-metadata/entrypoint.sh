#!/bin/bash
set -e

echo "Extracting metadata for mission $KLEINKRAM_MISSION_UUID"

# Authenticate
klein login --key "$KLEINKRAM_API_KEY"

# Download data
mkdir /data
klein download -m "$KLEINKRAM_MISSION_UUID" --dest /data

# Extract metadata
python3 /metadata.py /data /out/metadata.json

echo "Metadata extraction complete."
