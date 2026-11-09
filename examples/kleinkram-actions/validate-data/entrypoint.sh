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

# Report what the checksums say about the mission.
#
# These are findings, not failures. The action still does its job and exits 0,
# so it stays DONE - Kleinkram shows it in amber as "done with warnings" rather
# than pretending nothing was wrong or failing a run that produced its output.
file_count=$(wc -l < /out/checksums.txt)
klein action info "checksummed $file_count file(s)" --code FILES_CHECKED

if [ "$file_count" -eq 0 ]; then
    klein action warn "mission contains no files to validate" --code EMPTY_MISSION
fi

# A zero-byte file is almost always an upload that was interrupted.
find . -type f -empty | while IFS= read -r empty_file; do
    klein action warn "file is empty" --file "${empty_file#./}" --code EMPTY_FILE
done

# Two files with the same checksum are byte-identical, which usually means the
# same recording was uploaded twice under different names.
for checksum in $(awk '{ print $1 }' /out/checksums.txt | sort | uniq -d); do
    duplicates=$(awk -v hash="$checksum" \
        '$1 == hash { sub(/^\.\//, "", $2); printf "%s%s", separator, $2; separator = ", " }' \
        /out/checksums.txt)
    klein action warn "identical content uploaded more than once: $duplicates" \
        --code DUPLICATE_CONTENT
done

echo "Validation complete. Checksums saved to checksums.txt"
