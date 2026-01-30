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
UPLOAD_JSON="/var/www/astro-test/uploads/methodology.json"
TARGET_JSON="$REPO_DIR/src/data/methodology.json"

cd "$REPO_DIR"

echo "---- DEPLOY START $(date) ----"

OLD_HASH=""
[ -f "$TARGET_JSON" ] && OLD_HASH=$(sha256sum "$TARGET_JSON" | awk '{print $1}')

/usr/bin/git reset --hard
/usr/bin/git clean -fd
/usr/bin/git pull origin main

/usr/bin/npm install

if [ -f "$UPLOAD_JSON" ]; then
  cp "$UPLOAD_JSON" "$TARGET_JSON"
  echo "Copied uploaded methodology.json"
fi

NEW_HASH=""
[ -f "$TARGET_JSON" ] && NEW_HASH=$(sha256sum "$TARGET_JSON" | awk '{print $1}')

if [ "$OLD_HASH" != "$NEW_HASH" ]; then
  echo "✅ JSON changed → forcing clean Astro build"
  rm -rf dist node_modules/.vite
  /usr/bin/npm run build
else
  echo "ℹ️ JSON unchanged → skipping build"
fi

echo "---- DEPLOY END $(date) ----"
