#!/usr/bin/env bash
# Runs inside the app container: `make backup` (and `make restore`, before it
# overwrites anything) call it with `docker compose exec`/`run`.
#
# Writes /data/backups/academy-<UTC time>.db.gz, in the same volume as the
# database, and deletes backups there older than $ACADEMY_BACKUP_KEEP_DAYS
# days. `make backup` then copies them out to backups/ on the host.
set -euo pipefail

db=${ACADEMY_DB:-/data/academy.db}
dest=${ACADEMY_BACKUP_DIR:-/data/backups}
keep_days=${ACADEMY_BACKUP_KEEP_DAYS:-30}

if [[ ! -f $db ]]; then
  echo "no database at $db yet, nothing to back up"
  exit 0
fi

mkdir -p "$dest"
stamp=$(date -u +%Y%m%d-%H%M%S)
tmp="$dest/.partial-$stamp.db"
trap 'rm -f "$tmp" "$tmp.gz"' EXIT

# .backup copies a transactionally consistent snapshot while the app keeps
# serving; a plain cp of a WAL-mode database can capture a torn state.
sqlite3 "$db" ".backup '$tmp'"
check=$(sqlite3 "$tmp" "PRAGMA integrity_check")
if [[ $check != ok ]]; then
  echo "backup failed its integrity check: $check" >&2
  exit 1
fi
gzip -9 "$tmp"
mv "$tmp.gz" "$dest/academy-$stamp.db.gz"
echo "backup written: $dest/academy-$stamp.db.gz ($(du -h "$dest/academy-$stamp.db.gz" | cut -f1))"

find "$dest" -maxdepth 1 -name 'academy-*.db.gz' -mtime +"$keep_days" -delete
