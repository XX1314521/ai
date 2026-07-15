#!/bin/sh
set -eu

interval_hours="${BACKUP_INTERVAL_HOURS:-24}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p /backups
mc alias set aikart-minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null

while true; do
    stamp="$(date +%Y%m%d-%H%M%S)"
    target="/backups/$stamp"
    mkdir -p "$target/minio"

    pg_dump "$DATABASE_URL" | gzip -9 > "$target/aikart-postgres.sql.gz"
    mc mirror --overwrite "aikart-minio/$MINIO_BUCKET" "$target/minio" >/dev/null
    printf '%s\n' "backup completed: $stamp"

    find /backups -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -exec rm -rf -- {} +
    sleep "$((interval_hours * 3600))"
done
