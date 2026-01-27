# #!/bin/bash
# set -e
# # Ensure cron has access to node, npm, git
# export PATH=/usr/bin:/bin:/usr/local/bin
# # Move to project root
# cd /var/www/astro-test/scorecard_cms
# echo "---- DEPLOY START $(date) ----"
# # Always deploy exactly what is on GitHub
# git checkout main
# git fetch origin
# git reset --hard origin/main
# git clean -fd
# # Install dependencies
# npm install
# # Run custom script (if required)
# node scripts/updateMethodology.js
# # Build Astro (static build)
# npm run build
# echo "---- DEPLOY END $(date) ----"


#!/bin/bash
set -e

cd /var/www/astro-test/scorecard_cms

echo "---- DEPLOY START $(date) ----"

git reset --hard
git clean -fd


git pull origin main
npm install
node scripts/updateMethodology.cjs
npm run build

echo "---- DEPLOY END $(date) ----"

