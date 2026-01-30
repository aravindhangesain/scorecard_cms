#!/bin/bash
set -e

exec 9>/tmp/scorecard_deploy.lock || exit 1
flock -n 9 || exit 0

REPO_DIR="/var/www/astro-test/scorecard_cms"
UPLOAD_JSON="/var/www/astro-test/uploads/methodology.json"
TARGET_JSON="$REPO_DIR/src/data/methodology.json"

cd "$REPO_DIR"

echo "---- DEPLOY START $(date) ----"

git reset --hard
git clean -fd
git pull origin main

npm install

if [ -f "$UPLOAD_JSON" ]; then
  echo "📦 Applying uploaded JSON"
  cp "$UPLOAD_JSON" "$TARGET_JSON"
  rm -rf dist node_modules/.vite
  npm run build
else
  echo "ℹ️ No uploaded JSON found → skipping build"
fi

echo "---- DEPLOY END $(date) ----"
