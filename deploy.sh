#!/bin/bash
set -e

export PATH=/usr/bin:/bin:/usr/local/bin

cd /var/www/astro-test/scorecard_cms

echo "---- DEPLOY START $(date) ----"

git pull origin main
npm install
node scripts/updateMethodology.js
npm run build

echo "---- DEPLOY END $(date) ----"

