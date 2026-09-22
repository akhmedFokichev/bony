#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

repo=$(pwd)
index=$(mktemp)
trap 'rm -f "$index"' EXIT

export GIT_INDEX_FILE="$index"
export GIT_WORK_TREE="$repo/dist"
export GIT_DIR="$repo/.git"
cd "$repo/dist"
git read-tree --empty
git add -A
tree=$(git write-tree)
cd "$repo"
unset GIT_INDEX_FILE GIT_WORK_TREE

branch=hosting
if git show-ref --verify --quiet "refs/heads/$branch"; then
  if [ "$(git rev-parse "$branch^{tree}")" = "$tree" ]; then
    echo "hosting already matches this build"
    git push -u origin "$branch"
    exit 0
  fi
  commit=$(git commit-tree "$tree" -p "$branch" -m "Publish production build")
else
  commit=$(git commit-tree "$tree" -m "Publish production build")
fi

git update-ref "refs/heads/$branch" "$commit"
git push -u origin "$branch"
