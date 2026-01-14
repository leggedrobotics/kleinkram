#!/bin/bash
set -e

# Show nvidia-smi output
echo "Show GPU info:"
nvidia-smi

echo "Kleinkram CLI version: $(klein --version)"

# Authenticate
klein login --key "$KLEINKRAM_API_KEY"

# List Files
echo "List Files of Mission $KLEINKRAM_MISSION_UUID:"
klein list files -m "$KLEINKRAM_MISSION_UUID"
