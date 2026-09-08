#!/bin/sh
# Fails the build when BACKEND_URL was supplied but did not end up in the
# bundle. Guards the production image against silently shipping the
# http://localhost:3000 fallback (see PR #2378).
set -eu

dist_dir="${1:-dist/spa}"
url="$(printf '%s' "${BACKEND_URL:-}" | tr -d '[:space:]')"

if [ -z "$url" ]; then
    echo "check-backend-url: BACKEND_URL not set, skipping bundle assertion"
    exit 0
fi

if grep -rqF -- "$url" "$dist_dir"; then
    echo "check-backend-url: bundle contains BACKEND_URL=$url"
    exit 0
fi

echo "check-backend-url: BACKEND_URL=$url is missing from $dist_dir" >&2
exit 1
