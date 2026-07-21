#!/bin/sh
set -e

echo "🔄 Waiting for PostgreSQL to be ready..."

# Wait for postgres
until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" 2>/dev/null; do
  echo "⏳ PostgreSQL not ready yet, waiting..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"
echo "🚀 Starting application..."

echo "Applying database migrations..."
./node_modules/.bin/typeorm migration:run -d dist/config/database.config.js

exec node dist/main
