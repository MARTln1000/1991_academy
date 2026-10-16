#!/bin/sh
# Continuous deployment from cron (make auto-update-on), every 5 minutes.
#
# When the tracked branch has new commits: back up the database, fast-forward,
# validate a changed Caddyfile, rebuild and restart. On failure, roll back to
# the previous commit and skip the failed one until a newer commit arrives.
# Never discards local changes or follows rewritten history.
#
# --refresh (weekly): back up, then rebuild on the latest base images.
# Log: backups/auto-update.log

set -u
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.." || exit 1

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') $*"; }

# Single instance; a stale lock (killed run) expires after an hour.
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

if [ "${1:-}" = "--refresh" ]; then
    if ! make backup >/dev/null 2>&1; then
        log "weekly refresh: the database backup failed, so the refresh was skipped. Check 'make status' and 'make logs'."
        exit 1
    fi
    if make refresh >/dev/null 2>&1; then
        log "weekly refresh: Caddy and Python base images are up to date"
        exit 0
    fi
    log "weekly refresh FAILED (no network, or Docker Hub unreachable?). The site keeps its current images unless 'make status' says otherwise."
    exit 1
fi

branch=$(git symbolic-ref --quiet --short HEAD) || {
    log "not on a branch (a rollback with git checkout?): not updating. 'git checkout master' turns updates back on."
    exit 0
}
git fetch --quiet origin "$branch" || { log "git fetch failed: no network, or GitHub is unreachable"; exit 1; }
old=$(git rev-parse HEAD)
new=$(git rev-parse "origin/$branch")
[ "$old" = "$new" ] && exit 0

failed=.git/auto-update-failed
[ "$(cat "$failed" 2>/dev/null)" = "$new" ] && exit 0   # known-bad commit

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
caddy_changed() { [ "$caddyfile" != "$(git rev-parse HEAD:deploy/Caddyfile 2>/dev/null)" ]; }
if git merge --ff-only --quiet "$new" &&
   { ! caddy_changed || make check-caddy >/dev/null 2>&1; } &&
   make up >/dev/null 2>&1; then
    if caddy_changed; then
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
