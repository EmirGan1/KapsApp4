#!/usr/bin/env bash
# Safe routine production deployment script for KapsApp.
#
# Guarantees:
#   - Never modifies, overwrites, resets, deletes, or auto-restores the production DB.
#   - Verifies the production SQLite database exists OUTSIDE the Git repository.
#   - Refuses to proceed if tracked runtime SQLite files appear in the repo.
#   - Performs fast-forward git pull, clean build, PM2 reload/restart, and health check.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Load .env values without overriding already-exported shell vars
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi

TARGET_DATA_DIR="${KAPSAPP_DATA_DIR:-/var/lib/kapsapp}"
TARGET_DB="${DATABASE_PATH:-${KAPSAPP_DB_PATH:-${TARGET_DATA_DIR}/kapsapp.db}}"
PORT_CHECK="${PORT:-5000}"

echo "[DEPLOY] App directory: $APP_DIR"
echo "[DEPLOY] Configured production DB: $TARGET_DB"

# Ensure production DB is outside the Git working directory (unless remote Turso/LibSQL is used)
if [ -z "${TURSO_DATABASE_URL:-}" ] && [ -z "${LIBSQL_URL:-}" ]; then
  case "$TARGET_DB" in
    "$APP_DIR"/*)
      echo "[DEPLOY ABORTED] Production DB ($TARGET_DB) is inside the Git working directory ($APP_DIR)." >&2
      echo "Run the one-time migration first: see docs/PRODUCTION_DB_MIGRATION.md" >&2
      exit 1
      ;;
  esac

  if [ ! -s "$TARGET_DB" ]; then
    echo "[DEPLOY ABORTED] Expected migrated production DB at $TARGET_DB does not exist or is empty." >&2
    echo "Refusing to start with an empty database or auto-restore any backup." >&2
    echo "Run the one-time migration first: see docs/PRODUCTION_DB_MIGRATION.md" >&2
    exit 1
  fi
fi

# Verify no tracked SQLite files are present in Git
node scripts/check-no-tracked-db.mjs --strict-git

# Fast-forward pull only (never hard-reset or clean untracked user uploads/data)
git fetch origin main
git pull --ff-only origin main

# Install dependencies & build
npm ci
npm run build

# Restart PM2 with updated env
pm2 restart ecosystem.config.cjs --env production --update-env

# Verify health endpoint responds 200 OK
echo "[DEPLOY] Waiting for http://127.0.0.1:${PORT_CHECK}/api/health ..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT_CHECK}/api/health" >/dev/null 2>&1; then
    echo "[DEPLOY OK] KapsApp is healthy on port ${PORT_CHECK}. Production DB untouched: ${TARGET_DB}"
    exit 0
  fi
  sleep 1
done

echo "[DEPLOY ERROR] Health check failed after 30s. Inspect: pm2 logs kapsapp-production --lines 100" >&2
exit 1
