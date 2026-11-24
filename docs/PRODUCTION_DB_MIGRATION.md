# KapsApp Production SQLite Separation & Migration Runbook

## Why This Fix Is Permanent

Previously, SQLite runtime files (`local.db`, `local.db-wal`, `local.db-shm`) lived inside the Git working directory (`/var/www/KapsApp/`) and were tracked by Git. During updates, `git pull` could overwrite or revert `local.db` while `local.db-wal` / `local.db-shm` belonged to a different live database state, causing `SQLITE_CORRUPT` errors and `502 Bad Gateway` outages.

With this fix:
1. All runtime SQLite files (`*.db`, `*.db-wal`, `*.db-shm`, `*.db-journal`, `*.sqlite*`) are ignored by `.gitignore` and blocked from commits by `.githooks/pre-commit`, `npm run check:db-guard`, and GitHub Actions (`sqlite-guard.yml`).
2. All database connections across `server.ts` and operational scripts share one canonical resolver (`src/server/dbConfig.ts`) using environment variables (`TURSO_DATABASE_URL` / `LIBSQL_URL` -> `DATABASE_PATH` / `KAPSAPP_DB_PATH` -> `KAPSAPP_DATA_DIR` -> production default `/var/lib/kapsapp/kapsapp.db`).
3. Production startup refuses to boot if a local SQLite database resides inside a Git working directory or if an unmigrated legacy `./local.db` exists while `/var/lib/kapsapp/kapsapp.db` is missing.
4. `server.ts` runs `PRAGMA busy_timeout = 5000`, `PRAGMA journal_mode = WAL`, `PRAGMA quick_check`, and graceful `SIGINT`/`SIGTERM` shutdown (`PRAGMA wal_checkpoint(PASSIVE)` + `client.close()`).

---

## CRITICAL ORDERING WARNING

> **Removing `local.db`, `local.db-wal`, and `local.db-shm` from Git tracking means the NEXT `git pull` on an existing production server checkout WILL DELETE those files from `/var/www/KapsApp/`.**
>
> Therefore, you **MUST** execute **Phase 1 (migrate & back up on production)** **BEFORE** running `git pull` in **Phase 3**.

---

## Phase 1 — One-Time Production Migration (Run on VDS BEFORE `git pull`)

Run these commands on your production server (assuming `/var/www/KapsApp` is the checkout and `kapsapp-production` is the PM2 app name):

```bash
cd /var/www/KapsApp

# 1. Stop all database writers cleanly
pm2 stop kapsapp-production
pm2 status

# 2. Prepare the persistent data directory outside the Git checkout
sudo mkdir -p /var/lib/kapsapp/backups
sudo chown -R "$(whoami):$(id -gn)" /var/lib/kapsapp
sudo chmod 750 /var/lib/kapsapp
sudo chmod 700 /var/lib/kapsapp/backups

# 3. Safely checkpoint WAL, create a verified standalone backup, migrate to
#    /var/lib/kapsapp/kapsapp.db, and verify PRAGMA integrity_check + row counts.
#    (If scripts/migrate-sqlite-db.mjs is not yet in this checkout, fetch ONLY
#     the migration helper first without touching local.db*, OR run the built-in
#     Python sqlite3 backup/migration block below.)
python3 - <<'PY'
import os, pathlib, sqlite3, sys
from datetime import datetime, timezone

src = pathlib.Path("/var/www/KapsApp/local.db").resolve(strict=True)
dst = pathlib.Path("/var/lib/kapsapp/kapsapp.db").resolve()
backup_dir = pathlib.Path("/var/lib/kapsapp/backups").resolve()

if dst.exists():
    sys.exit(f"ABORT: Target already exists: {dst} (never overwrite production DB)")

ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup = backup_dir / f"pre-migration-{ts}.db"
staged = dst.parent / f".{dst.name}.migrating-{os.getpid()}.tmp"

def snapshot(db_path):
    with sqlite3.connect(db_path) as con:
        chk = con.execute("PRAGMA integrity_check;").fetchall()
        if chk != [("ok",)]:
            sys.exit(f"ABORT: integrity_check failed on {db_path}: {chk}")
        tables = [
            r[0]
            for r in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
            ).fetchall()
        ]
        counts = {t: con.execute(f'SELECT COUNT(*) FROM "{t.replace(chr(34), chr(34)*2)}";').fetchone()[0] for t in tables}
        return counts

# Checkpoint WAL frames into source DB cleanly (all writers must be stopped)
with sqlite3.connect(src) as con:
    con.execute("PRAGMA busy_timeout = 5000;")
    busy, log_frames, checkpointed = con.execute("PRAGMA wal_checkpoint(TRUNCATE);").fetchone()
    print(f"WAL checkpoint(TRUNCATE): busy={busy}, log={log_frames}, checkpointed={checkpointed}")
    if busy != 0:
        sys.exit("ABORT: WAL checkpoint busy — stop all writers first!")

src_counts = snapshot(src)
print(f"Source OK: {len(src_counts)} tables, {sum(src_counts.values())} total rows")

# Verified standalone backup using SQLite Online Backup API
with sqlite3.connect(src) as s_con, sqlite3.connect(backup) as b_con:
    s_con.backup(b_con)
os.chmod(backup, 0o600)
b_counts = snapshot(backup)
if b_counts != src_counts:
    sys.exit("ABORT: Backup row counts differ from source!")
print(f"Verified backup created: {backup}")

# Atomic staged copy -> target (keep staged sidecar-free before rename)
with sqlite3.connect(src) as s_con, sqlite3.connect(staged) as t_con:
    s_con.backup(t_con)
os.chmod(staged, 0o640)
t_counts = snapshot(staged)
if t_counts != src_counts:
    staged.unlink(missing_ok=True)
    sys.exit("ABORT: Target row counts differ from source!")

if dst.exists():
    staged.unlink(missing_ok=True)
    sys.exit(f"ABORT: Target appeared concurrently: {dst}")

os.replace(staged, dst)
with sqlite3.connect(dst) as f_con:
    f_con.execute("PRAGMA busy_timeout = 5000;")
    f_con.execute("PRAGMA journal_mode = WAL;")
    f_con.execute("PRAGMA synchronous = NORMAL;")
    f_con.execute("PRAGMA wal_checkpoint(TRUNCATE);")
final_counts = snapshot(dst)
assert final_counts == src_counts
print(f"SUCCESS: Migrated and verified {dst} ({len(final_counts)} tables, {sum(final_counts.values())} rows)")
PY

# 4. Configure persistent database path in /var/www/KapsApp/.env
grep -q '^KAPSAPP_DATA_DIR=' .env 2>/dev/null \
  && sed -i 's|^KAPSAPP_DATA_DIR=.*|KAPSAPP_DATA_DIR=/var/lib/kapsapp|' .env \
  || echo 'KAPSAPP_DATA_DIR=/var/lib/kapsapp' >> .env

grep -q '^DATABASE_PATH=' .env 2>/dev/null \
  && sed -i 's|^DATABASE_PATH=.*|DATABASE_PATH=/var/lib/kapsapp/kapsapp.db|' .env \
  || echo 'DATABASE_PATH=/var/lib/kapsapp/kapsapp.db' >> .env
```

*(Once the new code is pulled, you can also run `node scripts/migrate-sqlite-db.mjs --dry-run` or use it for any other environment.)*

---

## Phase 2 — Remove Runtime SQLite Files from Git (`EmirGan1/KapsApp4` `main`)

Run these commands in your Git checkout of `EmirGan1/KapsApp4` on `main`:

```bash
# Untrack all runtime SQLite files from Git index WITHOUT deleting local files
git rm --cached --ignore-unmatch local.db local.db-wal local.db-shm local.db-journal

# Check if any other *.db / *.sqlite* files are tracked in Git
git ls-files '*.db' '*.db-*' '*.sqlite*' '*-wal' '*-shm' '*-journal'

# Enable the tracked pre-commit safeguard hook
npm run hooks:install
chmod +x .githooks/pre-commit scripts/safe-deploy.sh

# Verify zero tracked or staged SQLite runtime files remain
npm run check:db-guard

# Commit directly to main and push
git add -A
git commit -m "fix(db): permanently separate production SQLite from Git and prevent corruption"
git push origin main
```

---

## Phase 3 — Pull Update on Production & Start on `/var/lib/kapsapp/kapsapp.db`

Only run this **AFTER Phase 1 succeeded and `/var/lib/kapsapp/kapsapp.db` + `/var/lib/kapsapp/backups/pre-migration-*.db` are verified**:

```bash
cd /var/www/KapsApp

# Verify the migrated DB and backup are in place BEFORE pulling
ls -lh /var/lib/kapsapp/kapsapp.db /var/lib/kapsapp/backups/

# Discard any dirty tracked changes on the old in-repo local.db* files so ff-only pull succeeds
# (your real data is now safely in /var/lib/kapsapp/kapsapp.db + backups)
git checkout -- local.db local.db-wal local.db-shm 2>/dev/null || true

# Pull the commit that untracks local.db* and adds dbConfig + guards
git fetch origin main
git pull --ff-only origin main

# Enable pre-commit hook on server too
npm run hooks:install
npm run check:db-guard

# Install dependencies, build, and start PM2 with updated env
npm ci
npm run build
pm2 startOrRestart ecosystem.config.cjs --env production --update-env
pm2 save

# Verify logs show /var/lib/kapsapp/kapsapp.db and health endpoint is 200 OK
pm2 logs kapsapp-production --lines 40 --nostream
curl -fsS http://127.0.0.1:5000/api/health
```

---

## Phase 4 — Future Routine Production Updates

Normal updates will never touch `/var/lib/kapsapp/kapsapp.db`:

```bash
cd /var/www/KapsApp
bash scripts/safe-deploy.sh
```

Or manually:

```bash
cd /var/www/KapsApp
git pull --ff-only origin main
npm ci
npm run build
pm2 restart ecosystem.config.cjs --env production --update-env
```
