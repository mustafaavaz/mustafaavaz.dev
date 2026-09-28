#!/bin/sh
# Daily: regenerate activity.json and push it (as a bot identity that is not
# linked to the GitHub account, so it adds no contributions of its own).
set -eu
cd "$(dirname "$0")/.."
echo "== $(date '+%Y-%m-%d %H:%M')"
git pull -q --rebase --autostash origin main
node scripts/activity.mjs
if git diff --quiet -- src/data/activity.json; then echo "no change"; exit 0; fi
git -c user.name=activity-bot -c user.email=bot@mustafaavaz.dev \
  commit -q -m "chore: refresh activity" -- src/data/activity.json
git push -q origin main
echo "pushed"
