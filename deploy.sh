#!/bin/bash
set -e

export PATH=/usr/local/bin:/usr/bin:/bin
LOCKFILE="/tmp/scorecard_deploy.lock"

exec 9>"$LOCKFILE" || exit 1
flock -n 9 || exit 0

REPO_DIR="/var/www/astro-test/scorecard_cms"
UPLOAD_DIR="/var/www/astro-test/uploads"
DATA_DIR="$REPO_DIR/src/data"

declare -A FILE_MAP=(
  ["methodology.json"]="methodology.json"
  ["top-perfomers.json"]="top-perfomers.json"
)

cd "$REPO_DIR"
echo "---- DEPLOY START $(date) ----"

JSON_CHANGED=false

for SRC in "${!FILE_MAP[@]}"; do
  SRC_PATH="$UPLOAD_DIR/$SRC"
  DEST_PATH="$DATA_DIR/${FILE_MAP[$SRC]}"

  OLD_HASH=""
  NEW_HASH=""

  [ -f "$DEST_PATH" ] && OLD_HASH=$(sha256sum "$DEST_PATH" | awk '{print $1}')

  if [ -f "$SRC_PATH" ]; then
    cp "$SRC_PATH" "$DEST_PATH"
    echo "Copied $SRC → $DEST_PATH"
  fi

  [ -f "$DEST_PATH" ] && NEW_HASH=$(sha256sum "$DEST_PATH" | awk '{print $1}')

  if [ "$OLD_HASH" != "$NEW_HASH" ]; then
    JSON_CHANGED=true
    echo "$SRC changed"
  fi
done

# Update repo
git reset --hard
git clean -fd
git pull origin main
npm install

if [ "$JSON_CHANGED" = true ]; then
  echo "JSON changed → rebuilding Astro"
  rm -rf dist node_modules/.vite
  npm run build
else
  echo "No JSON changes → skipping build"
fi

echo "---- DEPLOY END $(date) ----"
