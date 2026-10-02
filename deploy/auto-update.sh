#!/bin/sh
# Keeps a server on the newest commit of the branch it runs (normally master),
# so a change pushed to GitHub goes live without anyone logging in to the
# server. `make auto-update-on` runs this from cron every 5 minutes, logging
# to backups/auto-update.log; `make auto-update-off` stops it.
#
# Nothing happens unless the branch on GitHub has moved. Then it:
#   1. snapshots the database (make backup), and stops if that fails;
#   2. fast-forwards to the new commit and rebuilds (what `make update` does);
#   3. if that fails, goes back to the commit that was running, rebuilds it,
#      and remembers the bad commit, so it isn't retried every 5 minutes.
#      The next push (a fix) is tried as usual.
# It never discards local changes and never moves backwards on its own.

set -u
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.." || exit 1

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') $*"; }

# One run at a time: a slow build can outlast the cron interval. A lock left
# behind by a run that was killed is cleared after an hour.
lock=.git/auto-update.lock
if ! mkdir "$lock" 2>/dev/null; then
    if [ -n "$(find "$lock" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then
        rmdir "$lock" 2>/dev/null
        mkdir "$lock" 2>/dev/null || exit 0
    else
        exit 0
    fi
fi
trap 'rmdir "$lock" 2>/dev/null' EXIT

branch=$(git symbolic-ref --quiet --short HEAD) || {
    log "not on a branch (a rollback with git checkout?): not updating. 'git checkout master' turns updates back on."
    exit 0
}
git fetch --quiet origin "$branch" || { log "git fetch failed: no network, or GitHub is unreachable"; exit 1; }
old=$(git rev-parse HEAD)
new=$(git rev-parse "origin/$branch")
[ "$old" = "$new" ] && exit 0

failed=.git/auto-update-failed
[ "$(cat "$failed" 2>/dev/null)" = "$new" ] && exit 0   # this commit already failed; wait for the next one

if ! git merge-base --is-ancestor "$old" "$new"; then
    log "origin/$branch is not ahead of what runs here ($(git rev-parse --short "$old")): history was rewritten, or this server has its own commits. Run 'make update' by hand."
    exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "files tracked by git were changed on this server: not updating. See 'git status'."
    exit 1
fi

log "updating $branch: $(git rev-parse --short "$old") -> $(git rev-parse --short "$new")"
if ! make backup >/dev/null 2>&1; then
    log "the database backup failed, so the update was skipped. Check 'make status' and 'make logs'."
    exit 1
fi

caddyfile=$(git rev-parse "$old:deploy/Caddyfile" 2>/dev/null)
if git merge --ff-only --quiet "$new" && make up >/dev/null 2>&1; then
    if [ "$caddyfile" != "$(git rev-parse HEAD:deploy/Caddyfile 2>/dev/null)" ]; then
        make restart-caddy >/dev/null 2>&1 || log "deploy/Caddyfile changed but Caddy didn't restart: run 'make restart'"
    fi
    make prune-images >/dev/null 2>&1
    rm -f "$failed"
    log "done: now running $(git log -1 --format='%h %s')"
    exit 0
fi

log "the new version failed to build or start: going back to $(git rev-parse --short "$old")"
echo "$new" > "$failed"
if git reset --hard --quiet "$old" && make up >/dev/null 2>&1; then
    log "back on $(git log -1 --format='%h %s'). $(git rev-parse --short "$new") will be skipped until a newer commit arrives."
else
    log "ROLLBACK FAILED: the site may be down. Check 'make status' and 'make logs'."
fi
exit 1
