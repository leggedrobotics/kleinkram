#!/bin/sh
# Mock of the ETH Long Term Storage (LTS) appliance.
#
# The real LTS is an NFSv3/SMB share in front of a tape library (StrongLink
# HSM). Once the "delay action timer" of a file ran out (1h by default) the
# file is sealed: it becomes read-only, is written to tape at two sites and
# only a 4 MB stub stays on disk. Sealed files can be deleted but never
# changed again.
#
# This container shares a volume with the queue consumer (standing in for the
# NFS mount) and seals files by handing them to root with mode 0444 once they
# are older than LTS_DELAY_ACTION_SECONDS. Recall latency is simulated by the
# queue consumer itself (LTS_SIMULATED_RECALL_SECONDS).
set -eu

ROOT=/lts
DELAY=${LTS_DELAY_ACTION_SECONDS:-60}
OWNER=${LTS_CLIENT_UID:-1000}:${LTS_CLIENT_GID:-1000}

mkdir -p "$ROOT/kleinkram"
chown "$OWNER" "$ROOT" "$ROOT/kleinkram"

echo "LTS mock ready: files are sealed ${DELAY}s after their last change"

while true; do
    now=$(date +%s)
    find "$ROOT" -type f ! -name '*.partial' ! -user root | while read -r file; do
        changed=$(stat -c %Y "$file")
        if [ $((now - changed)) -ge "$DELAY" ]; then
            chown root:root "$file"
            chmod 0444 "$file"
            echo "sealed and moved to tape: ${file#"$ROOT"/} ($(stat -c %s "$file") bytes)"
        fi
    done
    sleep 5
done
