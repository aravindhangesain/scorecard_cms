#!/bin/bash
set -e

# -------- LOCK (nohup-like behavior) --------
exec 9>/tmp/scorecard_deploy.lock || exit 1
flock -n 9 || exit 0

REPO_DIR="/var/www/astro-test/scorecard_cms"
UPLOAD_JSON="/var/www/astro-test/uploads/methodology.json"
TARGET_JSON="$REPO_DIR/src/data/methodology.json"

cd "$REPO_DIR"

echo "---- DEPLOY START $(date) ----"

# Hash before (current target inside repo)
OLD_HASH=""
if [ -f "$TARGET_JSON" ]; then
  OLD_HASH=$(sha256sum "$TARGET_JSON" | awk '{print $1}')
fi

echo "Step 1: Cleanup repo"
git reset --hard
git clean -fd

echo "Step 2: Pulling from Git..."
git pull origin main

echo "Step 3: Installing Dependencies..."
npm install

echo "Step 4: Apply uploaded methodology.json (if exists)"
if [ -f "$UPLOAD_JSON" ]; then
  cp "$UPLOAD_JSON" "$TARGET_JSON"
  echo "Copied: $UPLOAD_JSON -> $TARGET_JSON"
else
  echo "No uploaded file found at $UPLOAD_JSON (using repo version)"
fi

# Hash after copy
NEW_HASH=""
if [ -f "$TARGET_JSON" ]; then
  NEW_HASH=$(sha256sum "$TARGET_JSON" | awk '{print $1}')
fi

if [ "$OLD_HASH" != "$NEW_HASH" ]; then
  echo "✅ methodology.json changed → Building Astro..."
  npm run build
else
  echo "ℹ️ methodology.json unchanged → Skipping build"
fi

echo "---- DEPLOY END $(date) ----"
