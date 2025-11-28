#!/bin/bash

# Stop on errors
set -e
GIT_DIR="./.git"

timestamp=$(date "+%a %b %d %Y %H:%M:%S GMT%z (%Z)")
version=$(node -pe "require('./package.json').version")

# Initialize default values
git_commit="unknown"
git_branch="unknown"

# Check if the required .git metadata exists
if [ -f "$GIT_DIR/HEAD" ]; then
     git_commit=$(git --work-tree=. --git-dir="$GIT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")

    head_content=$(cat "$GIT_DIR/HEAD")

    if [[ "$head_content" =~ "ref: refs/heads/" ]]; then
        git_branch=$(echo "$head_content" | cut -d'/' -f3)
    else
        git_branch="DETACHED-$git_commit"
    fi
fi

# Construct TypeScript content
build_info="
const build = {
    version: \"${version}\",
    timestamp: \"${timestamp}\",
    message: null,
    git: {
        branch: \"${git_branch}\",
        hash: \"${git_commit}\"
    }
};

export default build;
"

# Write to file
echo "${build_info}" > ./src/build.ts
