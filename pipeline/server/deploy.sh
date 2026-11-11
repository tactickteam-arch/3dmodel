#!/bin/sh
# Keeps this server's copy of the catalogue in step with GitHub main: the files Vercel serves (.vercelignore's
# folders left out). Run every minute from the site user's crontab (setup.sh adds it); when main hasn't moved it
# does nothing. The swap is near-atomic (rsync --delay-updates), so a visitor never gets half a deploy.
set -eu
URL=https://github.com/tactickteam-arch/3dmodel.git
REPO="$HOME/3dmodel"
WEB=/var/www/sangeetha3d
MARK="$HOME/.deployed-commit"

[ -d "$REPO/.git" ] || git clone -q --depth 1 --branch main "$URL" "$REPO"
cd "$REPO"
git fetch -q --depth 1 origin main
new=$(git rev-parse FETCH_HEAD)
[ "$new" = "$(cat "$MARK" 2>/dev/null || true)" ] && exit 0

git reset -q --hard "$new"
rsync -a --delete --delay-updates --exclude-from=.vercelignore \
  --exclude=.git --exclude=.gitignore --exclude=.vercelignore --exclude=vercel.json ./ "$WEB/"
echo "$new" > "$MARK"
echo "$(date -Is) deployed $new"
