#!/bin/sh

# Stop on errors
set -e
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo "./.git")

timestamp=$(date "+%a %b %d %Y %H:%M:%S GMT%z (%Z)")
version=$(node -pe "require('./package.json').version")

# Initialize default values
git_commit="unknown"
git_branch="unknown"

# Check if the required .git metadata exists
if [ -f "$GIT_DIR/HEAD" ]; then
    # Try manual extraction first (works without git binary and with partial repo)
    head_content=$(cat "$GIT_DIR/HEAD")

    # POSIX-compatible check for "ref: " prefix
    case "$head_content" in
        "ref: "*)
            ref_path=$(echo "$head_content" | sed 's/ref: //')
            if [ -f "$GIT_DIR/$ref_path" ]; then
                git_commit=$(cat "$GIT_DIR/$ref_path")
            elif [ -f "$GIT_DIR/packed-refs" ]; then
                 # Fallback for packed refs
                 git_commit=$(grep "$ref_path" "$GIT_DIR/packed-refs" | awk '{print $1}')
            fi
            git_branch=$(echo "$ref_path" | sed 's/refs\/heads\///')
            ;;
        *)
            git_commit="$head_content"
            git_branch="DETACHED-$git_commit"
            ;;
    esac

    # Truncate to short hash (POSIX-compatible)
    git_commit=$(echo "$git_commit" | cut -c1-7)

    # Fallback to git command if manual extraction failed
    if [ -z "$git_commit" ] || [ "$git_commit" = "unknown" ]; then
         git_commit=$(git --work-tree=. --git-dir="$GIT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
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
