Backups & Postgres Migration Plan
================================

Postgres backups (example using pg_dump):

  # Full DB backup
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U $POSTGRES_USER -h $HOST -F c -b -v -f "backup-$(date -I).dump" $POSTGRES_DB

  # Restore
  PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U $POSTGRES_USER -h $HOST -d $POSTGRES_DB --clean backup-file.dump

Automated backups: schedule `pg_dump` to run daily and rotate using S3 or other durable storage.

Migrations
----------
- Migrations are included in `apps/api/migrations` and the Docker container runs with `AUTO_RUN_MIGRATIONS=true` by default.
- For production, review migrations and run them in a maintenance window or via your CI/CD pipeline.
