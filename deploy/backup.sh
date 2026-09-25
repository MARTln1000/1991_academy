#!/usr/bin/env bash
# Installed as /usr/local/sbin/academy-backup and run (as the academy user) by
# academy-backup.service: nightly via its timer, and before every deploy.
#
# Writes /var/backups/academy/academy-<UTC time>.db.gz and deletes backups
# older than $ACADEMY_BACKUP_KEEP_DAYS days. Restoring: README.md → Deploy.
set -euo pipefail

db=${ACADEMY_DB:-/var/lib/academy/academy.db}
dest=${ACADEMY_BACKUP_DIR:-/var/backups/academy}
keep_days=${ACADEMY_BACKUP_KEEP_DAYS:-30}

if [[ ! -f $db ]]; then
  echo "no database at $db yet, nothing to back up"
  exit 0
fi

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
