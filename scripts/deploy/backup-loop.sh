#!/bin/sh
set -eu
umask 077

: "${MYSQL_HOST:?MYSQL_HOST is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD_FILE:?MYSQL_PASSWORD_FILE is required}"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"

dump_file=''
cleanup_dump() {
  if [ -n "$dump_file" ]; then
    rm -f "$dump_file" || true
    dump_file=''
  fi
}
trap cleanup_dump EXIT
trap 'exit 1' HUP INT TERM

if ! restic snapshots >/dev/null 2>&1; then
  restic init
fi

run_backup() {
  backup_time=$(date -u +%Y%m%dT%H%M%SZ)
  dump_file=$(mktemp)
  if ! MYSQL_PWD="$(cat "$MYSQL_PASSWORD_FILE")" mysqldump \
    --host="$MYSQL_HOST" \
    --user="$MYSQL_USER" \
    --single-transaction \
    --no-tablespaces \
    --set-gtid-purged=OFF \
    --routines \
    --triggers \
    --events \
    "$MYSQL_DATABASE" > "$dump_file"; then
    echo "Reedito database dump failed; skipping this backup cycle." >&2
    cleanup_dump
    return 1
  fi

  if ! restic backup --stdin --stdin-filename "reedito-mysql-${backup_time}.sql" --tag mysql < "$dump_file"; then
    echo "Reedito database backup failed; skipping this backup cycle." >&2
    cleanup_dump
    return 1
  fi
  cleanup_dump

  if ! restic backup /backup/content --tag content; then
    echo "Reedito content backup failed; skipping retention cleanup." >&2
    return 1
  fi
  if ! restic forget --keep-daily 7 --keep-weekly 5 --keep-monthly 6 --prune; then
    echo "Reedito backup retention cleanup failed." >&2
    return 1
  fi
}

while :; do
  if run_backup; then
    sleep "$BACKUP_INTERVAL_SECONDS"
  else
    echo "Reedito backup failed; retrying in 10 minutes." >&2
    sleep 600
  fi
done
