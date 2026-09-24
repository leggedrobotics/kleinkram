#!/bin/sh
# Mock of a cold, write-once archive storage mounted over NFS.
#
# Kleinkram only needs the archive storage to be a mounted directory where
# written files become read-only for good after a delay ("sealed"), and where
# reading sealed files may be slow. ETH LTS is one such storage: a tape
# library behind an NFS/SMB share that seals files after its 1h "delay action
# timer", writes them to tape and only keeps a stub on disk.
#
# This container shares a volume with the queue consumer (standing in for the
# NFS mount) and seals files by handing them to root with mode 0444 once they
# are older than ARCHIVE_SEAL_DELAY_SECONDS. Slow reads are simulated by the
# queue consumer itself (ARCHIVE_SIMULATED_RECALL_SECONDS).
set -eu

ROOT=/archive
DELAY=${ARCHIVE_SEAL_DELAY_SECONDS:-60}
OWNER=${ARCHIVE_CLIENT_UID:-1000}:${ARCHIVE_CLIENT_GID:-1000}

mkdir -p "$ROOT/kleinkram"
chown "$OWNER" "$ROOT" "$ROOT/kleinkram"

echo "Archive storage mock ready: files are sealed ${DELAY}s after their last change"

while true; do
    now=$(date +%s)
    find "$ROOT" -type f ! -name '*.partial' ! -user root | while read -r file; do
        changed=$(stat -c %Y "$file")
        if [ $((now - changed)) -ge "$DELAY" ]; then
            chown root:root "$file"
            chmod 0444 "$file"
            echo "sealed: ${file#"$ROOT"/} ($(stat -c %s "$file") bytes)"
        fi
    done
    sleep 5
done
