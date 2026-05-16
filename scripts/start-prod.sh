#!/bin/bash

# Production start script for Build-Empire API
# Handles secrets loading, migrations, and server startup

set -e

# Load environment variables
if [ -f ".env.production" ]; then
    export $(cat .env.production | xargs)
fi

# Handle file-based secrets
if [ -n "$JWT_SECRET_FILE" ] && [ -f "$JWT_SECRET_FILE" ]; then
    export JWT_SECRET=$(cat "$JWT_SECRET_FILE")
fi

if [ -n "$ADMIN_PASSWORD_FILE" ] && [ -f "$ADMIN_PASSWORD_FILE" ]; then
    export ADMIN_PASSWORD=$(cat "$ADMIN_PASSWORD_FILE")
fi

SMTP_SECRET_FILE="${SMTP_PASS_FILE:-${SMTP_PASSWORD_FILE:-}}"
if [ -n "$SMTP_SECRET_FILE" ] && [ -f "$SMTP_SECRET_FILE" ]; then
    export SMTP_PASS=$(cat "$SMTP_SECRET_FILE")
elif [ -n "$SMTP_PASSWORD" ] && [ -z "$SMTP_PASS" ]; then
    export SMTP_PASS="$SMTP_PASSWORD"
fi

# Run migrations if AUTO_RUN_MIGRATIONS is true
if [ "$AUTO_RUN_MIGRATIONS" = "true" ] || [ "$AUTO_RUN_MIGRATIONS" = "1" ]; then
    echo "🔄 Running database migrations..."
    npm run migrate -w @build-empire/api || echo "⚠️  Migration completed with status code $?"
fi

# Start the API server
echo "🚀 Starting Build-Empire API server..."
exec npm run start -w @build-empire/api
