#!/bin/sh

# allocate 20GB of disk space
echo "Write 20GB of zeros to /tmp_disk/disk_space_test"
dd if=/dev/zero of=/tmp_disk/disk_space_test bs=1M count=20000

echo "Wait for 30s"
sleep 30
echo "Done, exiting"