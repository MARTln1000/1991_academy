#!/usr/bin/env bash
# The server half of a deploy. Runs ON THE SERVER as the deploy user:
# deploy/deploy.sh uploads a release, then runs the copy inside it:
#
#   bash /opt/academy/releases/<release>/deploy/activate.sh <release>
#
# To go back to the release before the live one (no rebuild, a few seconds):
#
#   bash /opt/academy/current/deploy/activate.sh --rollback
#
# Steps, in an order that keeps a bad release away from users:
#   1. Build the release's own virtualenv (versions pinned by requirements.lock)
#      and check the app imports. The live site is untouched so far, so a
#      broken release fails here with zero downtime.
#   2. Back up the database (academy-backup.service).
#   3. Stop the service, point /opt/academy/current at the release, start it.
#   4. Wait for /api/health to report this release's commit. If the app
#      crashes on startup, doesn't answer within $HEALTH_TIMEOUT seconds, or
#      this script fails in any other way after step 3, the previous release
#      is put back (see finish) and the exit status is non-zero.
#   5. Delete all but the newest $KEEP releases.
set -euo pipefail
export LC_ALL=C   # release names must sort the same everywhere
umask 022         # the academy user has to be able to read the virtualenv

APP_ROOT=${ACADEMY_ROOT:-/opt/academy}
KEEP=${ACADEMY_KEEP_RELEASES:-5}
HEALTH_URL=${ACADEMY_HEALTH_URL:-http://127.0.0.1:8735/api/health}
HEALTH_TIMEOUT=${ACADEMY_HEALTH_TIMEOUT:-30}

log()  { printf '==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

live_release() {  # the release `current` points at, or nothing
  if [[ -L $APP_ROOT/current ]]; then basename "$(readlink -f "$APP_ROOT/current")"; fi
}

revision_of() {  # the commit a release was built from, or nothing
  cat "$APP_ROOT/releases/$1/REVISION" 2>/dev/null || true
}

restarts() {  # automatic restarts after a crash so far (never resets); empty if unknown
  local n
  n=$(systemctl show -p NRestarts --value academy.service 2>/dev/null) || true
  if [[ $n =~ ^[0-9]+$ ]]; then echo "$n"; fi
}

RESTARTS_AT_START=""
switch_to() {  # stop the app, repoint `current` atomically, start the app
  sudo -n systemctl stop academy.service
  ln -sfn "releases/$1" "$APP_ROOT/.current.tmp"
  mv -Tf "$APP_ROOT/.current.tmp" "$APP_ROOT/current"
  sudo -n systemctl start academy.service || true   # a failed start fails the health check
  RESTARTS_AT_START=$(restarts)
}

HEALTH=""
FAILURE=""
wait_healthy() {  # wait_healthy REVISION: until /api/health is ok and reports REVISION
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) n
  while ((SECONDS < deadline)); do
    # Matching the revision proves the answer comes from the process just
    # started, not from something else still holding the port.
    if HEALTH=$(curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null) &&
      python3 -c 'import json, sys
h = json.loads(sys.argv[1])
sys.exit(0 if h.get("ok") is True and h.get("revision") == (sys.argv[2] or None) else 1)' \
        "$HEALTH" "$1" 2>/dev/null; then
      return 0
    fi
    # systemd restarting it means it crashed: fail now instead of keeping the
    # site down for the rest of the timeout.
    n=$(restarts)
    if [[ -n $n && -n $RESTARTS_AT_START ]] && ((n > RESTARTS_AT_START)); then
      FAILURE="crashed on startup"
      return 1
    fi
    sleep 1
  done
  FAILURE="did not pass the health check within ${HEALTH_TIMEOUT}s"
  return 1
}

warn_about_config() {  # flag settings that must never be on in production
  python3 -c 'import json, sys
h = json.loads(sys.argv[1])
if h.get("debug"):
    print("WARNING: ACADEMY_DEBUG is on (API docs exposed, no caching); set ACADEMY_DEBUG=0 in /etc/academy/academy.env", file=sys.stderr)
if h.get("cpp"):
    print("WARNING: the C++ runner is on and executes learner code on this server; set ACADEMY_CPP=0 in /etc/academy/academy.env", file=sys.stderr)
if not h.get("email"):
    print("note: SMTP is not configured, so password-reset links are only written to the log", file=sys.stderr)' "$1"
}

# State for finish(); set by main as it goes.
live="" release="" dir="" fresh=0 switched=0 verified=0

finish() {  # EXIT trap: whatever made us stop, never leave a bad release live
  local rc=$?
  set +e
  if ((switched && !verified)) && [[ -n $live && $live != "$release" && -d $APP_ROOT/releases/$live ]]; then
    log "rolling back to $live"
    switch_to "$live"
    if wait_healthy "$(revision_of "$live")"; then
      log "rolled back: $live is live again"
    else
      warn "$live is not healthy either, so the site is DOWN. Check: journalctl -u academy.service"
    fi
  fi
  # A fresh upload that isn't live is deleted, so it can't be picked by
  # --rollback or crowd good releases out of the $KEEP kept.
  if ((fresh)) && [[ $(live_release) != "$release" ]]; then rm -rf "$dir"; fi
  exit "$rc"
}

main() {
  [[ $# -eq 1 ]] || die "usage: activate.sh RELEASE | --rollback"
  cd "$APP_ROOT/releases" || die "$APP_ROOT/releases is missing; run deploy/setup-server.sh first"

  exec 9>"$APP_ROOT/.deploy.lock"
  flock -n 9 || die "another deploy is in progress"

  live=$(live_release)
  if [[ $1 == --rollback ]]; then
    [[ -n $live ]] || die "nothing is live, so there is nothing to roll back from"
    release=$(printf '%s\n' * | awk -v live="$live" '$0 < live' | tail -n 1)
    [[ -n $release ]] || die "no release older than $live is left on the server"
  else
    release=$1
  fi
  [[ $release =~ ^[A-Za-z0-9._-]+$ && -d $release ]] || die "no such release: $release"
  dir="$APP_ROOT/releases/$release"
  [[ $release != "$live" ]] || log "note: $release is already live; restarting it"
  [[ -x $dir/.venv/bin/python ]] || fresh=1
  trap finish EXIT

  # 1. build + import check, while the old release keeps serving
  if ((fresh)); then
    log "building the virtualenv"
    python3 -m venv "$dir/.venv"
    "$dir/.venv/bin/pip" install --quiet --disable-pip-version-check \
      -r "$dir/requirements.txt" -c "$dir/requirements.lock"
  fi
  (cd "$dir" && ACADEMY_CPP=0 .venv/bin/python -c 'import app') ||
    die "the release fails to import; the live site was not touched"

  # 2. back up the database
  log "backing up the database"
  if ! sudo -n systemctl start academy-backup.service; then
    sudo -n journalctl -u academy-backup.service -n 20 --no-pager >&2 || true
    die "the database backup failed, so nothing was deployed"
  fi

  # 3. switch. From here on, any exit before `verified=1` rolls back.
  log "switching ${live:-(nothing live)} -> $release"
  switched=1
  switch_to "$release"

  # 4. verify
  if ! wait_healthy "$(revision_of "$release")"; then
    warn "$release $FAILURE. Service log:"
    sudo -n journalctl -u academy.service -n 60 --no-pager >&2 || true
    exit 1
  fi
  verified=1
  log "live: $HEALTH"
  warn_about_config "$HEALTH"

  # 5. keep the newest $KEEP releases (never the live one)
  local old
  for old in $(printf '%s\n' * | head -n -"$KEEP"); do
    [[ $old == "$release" ]] || rm -rf -- "$old" || warn "could not delete old release $old"
  done
}

main "$@"
