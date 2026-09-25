#!/usr/bin/env bash
# Deploys a commit of this repository to the production server.
#
#   deploy/deploy.sh SSH_TARGET [GIT_REF]
#
#   deploy/deploy.sh academy            # HEAD, via a Host alias in ~/.ssh/config
#   deploy/deploy.sh academy 3fb8571    # any commit or tag (an older one = rollback)
#
# GitHub Actions runs exactly this for every push to master
# (.github/workflows/deploy.yml). SSH_TARGET is anything `ssh` accepts. With
# ACADEMY_URL set (e.g. https://academy.example.com) the public site is
# checked at the end as well.
#
#   1. Export the commit with `git archive`: tracked files only, so the local
#      database, .venv and .env files can never be uploaded. Add a REVISION file.
#   2. rsync it to /opt/academy/releases/<UTC time>-<commit>/. Files unchanged
#      since the live release are hard-linked on the server instead of sent:
#      the course assets are ~90 MB, a typical deploy sends a few kilobytes.
#   3. Run deploy/activate.sh from the uploaded release: build, back up,
#      switch, health-check, and roll back automatically on failure.
#   4. With ACADEMY_URL set, confirm the public site serves the new commit.
set -euo pipefail

APP_ROOT=/opt/academy

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ $# -ge 1 && $# -le 2 ]] || die "usage: deploy/deploy.sh SSH_TARGET [GIT_REF]"
target=$1
ref=${2:-HEAD}

cd "$(git rev-parse --show-toplevel)"
sha=$(git rev-parse --verify --quiet "$ref^{commit}") || die "not a commit: $ref"
release="$(date -u +%Y%m%d-%H%M%S)-${sha:0:7}"
if [[ $ref == HEAD ]] && ! git diff --quiet HEAD; then
  log "note: uncommitted changes are not deployed, only commit ${sha:0:7}"
fi

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
git archive "$sha" | tar -x -C "$stage"
printf '%s\n' "$sha" >"$stage/REVISION"

# shellcheck disable=SC2029  # expanding locally is the point: plain paths, no quoting needed
server=$(ssh "$target" "if [ ! -d $APP_ROOT/releases ]; then echo unprepared;
  elif [ -e $APP_ROOT/current ]; then echo live; else echo empty; fi") ||
  die "could not connect to $target (see the ssh error above)"
[[ $server != unprepared ]] || die "$target has no $APP_ROOT/releases; run deploy/setup-server.sh there first"

# Unchanged files are hard-linked against the live release (none on a first deploy).
link_dest=""
if [[ $server == live ]]; then link_dest="--link-dest=$APP_ROOT/current/"; fi

log "uploading $release"
# -rlp without -t, plus --checksum: files are compared by content, so ones that
# git archive stamped with a new mtime still count as unchanged and get linked.
stats=$(rsync -rlp --checksum --chmod=Dgo+rx,Fgo+r --stats ${link_dest:+"$link_dest"} \
  "$stage/" "$target:$APP_ROOT/releases/$release/")
grep -E 'files transferred|Total bytes sent' <<<"$stats" | sed 's/^/    /' || true

log "activating $release"
# shellcheck disable=SC2029  # expanding locally is the point: plain paths, no quoting needed
ssh "$target" bash "$APP_ROOT/releases/$release/deploy/activate.sh" "$release"

if [[ -n ${ACADEMY_URL:-} ]]; then
  url="${ACADEMY_URL%/}/api/health"
  log "checking $url"
  body=$(curl -fsS --retry 5 --retry-delay 2 --retry-all-errors "$url") ||
    die "$url did not answer"
  python3 -c 'import json, sys
sys.exit(0 if json.loads(sys.argv[1]).get("revision") == sys.argv[2] else 1)' "$body" "$sha" ||
    die "$url is not serving ${sha:0:7}: $body"
fi

log "deployed ${sha:0:7} as $release"
