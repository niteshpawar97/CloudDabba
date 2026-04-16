#!/bin/sh
set -e

echo "=== CloudDabba Starting ==="

# Wait for PostgreSQL
echo "Waiting for database..."
MAX_RETRIES=30
RETRY=0
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Database not reachable after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "  Database not ready, retrying ($RETRY/$MAX_RETRIES)..."
  sleep 2
done
echo "Database connected!"

# Apply schema
echo "Applying database schema..."
npx prisma db push --skip-generate 2>&1 || true

# Seed (skip if already set up)
echo "Running seed..."
npx prisma db seed 2>&1 || true

echo "=== Starting CloudDabba API ==="
exec node dist/server.js
