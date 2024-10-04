#!/bin/sh

echo "Request 16GB of memory"
head -c 16G /dev/zero | tail | sleep 120
echo "Done, exiting"