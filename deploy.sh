#!/bin/bash
set -e

export PATH=/usr/local/bin:/usr/bin:/bin

LOCKFILE="/tmp/scorecard_deploy.lock"

exec 9>"$LOCKFILE" || exit 1
if ! flock -n 9; then
  echo "Another deploy is running, exiting."
  exit 0
fi

REPO_DIR="/var/www/astro-test/scorecard_cms"
UPLOAD_DIR="/var/www/astro-test/uploads"
DATA_DIR="$REPO_DIR/src/data"

FILES=(
  "methodology.json"
  "top-perfomers.json"
)

cd "$REPO_DIR"

echo "---- DEPLOY START $(date) ----"

# Save old hashes
declare -A OLD_HASH
declare -A NEW_HASH

for file in "${FILES[@]}"; do
  if [ -f "$DATA_DIR/$file" ]; then
    OLD_HASH["$file"]=$(sha256sum "$DATA_DIR/$file" | awk '{print $1}')
  else
    OLD_HASH["$file"]=""
  fi
done

# Git update
/usr/bin/git reset --hard
/usr/bin/git clean -fd
/usr/bin/git pull origin main

/usr/bin/npm install

# Copy uploaded JSON files if they exist
JSON_CHANGED=false

for file in "${FILES[@]}"; do
  if [ -f "$UPLOAD_DIR/$file" ]; then
    cp "$UPLOAD_DIR/$file" "$DATA_DIR/$file"
    echo "Copied uploaded $file"
  fi

  if [ -f "$DATA_DIR/$file" ]; then
    NEW_HASH["$file"]=$(sha256sum "$DATA_DIR/$file" | awk '{print $1}')
  else
    NEW_HASH["$file"]=""
  fi

  if [ "${OLD_HASH[$file]}" != "${NEW_HASH[$file]}" ]; then
    JSON_CHANGED=true
    echo "$file changed"
  fi
done

# Build only if something changed
if [ "$JSON_CHANGED" = true ]; then
  echo "JSON changed → forcing clean Astro build"
  rm -rf dist node_modules/.vite
  /usr/bin/npm run build
else
  echo "JSON unchanged → skipping build"
fi

echo "---- DEPLOY END $(date) ----"