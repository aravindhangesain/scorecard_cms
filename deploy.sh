#!/bin/bash
set -e

cd /var/www/astro/lsdb_score_card

echo "---- DEPLOY START $(date) ----"

git pull origin main
npm install
node scripts/updateMethodology.js
npm run build

echo "---- DEPLOY END $(date) ----"

