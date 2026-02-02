#!/bin/bash
set -e

export PATH=/usr/local/bin:/usr/bin:/bin
LOCKFILE="/tmp/scorecard_deploy.lock"

exec 9>"$LOCKFILE" || exit 1
flock -n 9 || exit 0

REPO_DIR="/var/www/astro-test/scorecard_cms"
UPLOAD_DIR="/var/www/astro-test/uploads"
DATA_DIR="$REPO_DIR/src/data"

cd "$REPO_DIR"
echo "---- DEPLOY START $(date) ----"

# ------------------------------------------------
# 1️⃣ UPDATE GIT FIRST (CRITICAL)
# ------------------------------------------------
git reset --hard
git clean -fd
git pull origin main
npm install

JSON_CHANGED=false

# =================================================
# FILE_MAP1 → methodology.json
# =================================================
METHOD_SRC="$UPLOAD_DIR/methodology.json"
METHOD_DEST="$DATA_DIR/methodology.json"

METHOD_OLD_HASH=""
METHOD_NEW_HASH=""

[ -f "$METHOD_DEST" ] && METHOD_OLD_HASH=$(sha256sum "$METHOD_DEST" | awk '{print $1}')

if [ -f "$METHOD_SRC" ]; then
  cp "$METHOD_SRC" "$METHOD_DEST"
  echo "Copied methodology.json"
fi

[ -f "$METHOD_DEST" ] && METHOD_NEW_HASH=$(sha256sum "$METHOD_DEST" | awk '{print $1}')

if [ "$METHOD_OLD_HASH" != "$METHOD_NEW_HASH" ]; then
  JSON_CHANGED=true
  echo "methodology.json changed"
fi


# =================================================
# FILE_MAP2 → top-perfomers.json
# =================================================
TOP_SRC="$UPLOAD_DIR/top-perfomers.json"
TOP_DEST="$DATA_DIR/top-perfomers.json"

TOP_OLD_HASH=""
TOP_NEW_HASH=""

[ -f "$TOP_DEST" ] && TOP_OLD_HASH=$(sha256sum "$TOP_DEST" | awk '{print $1}')

if [ -f "$TOP_SRC" ]; then
  cp "$TOP_SRC" "$TOP_DEST"
  echo "Copied top-perfomers.json"
fi

[ -f "$TOP_DEST" ] && TOP_NEW_HASH=$(sha256sum "$TOP_DEST" | awk '{print $1}')

if [ "$TOP_OLD_HASH" != "$TOP_NEW_HASH" ]; then
  JSON_CHANGED=true
  echo "top-perfomers.json changed"
fi


# ------------------------------------------------
# 4️⃣ BUILD ONLY IF DATA CHANGED
# ------------------------------------------------
if [ "$JSON_CHANGED" = true ]; then
  echo "JSON changed → rebuilding Astro"
  rm -rf dist node_modules/.vite
  npm run build
else
  echo "No JSON changes → skipping build"
fi

echo "---- DEPLOY END $(date) ----"
