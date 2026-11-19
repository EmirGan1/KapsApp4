#!/usr/bin/env python3
"""Bind the existing Emirgan ID and verify an online SQLite backup before rollout."""
import argparse
import os
from pathlib import Path
import re
import sqlite3
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--database", required=True, type=Path)
parser.add_argument("--env", required=True, type=Path)
parser.add_argument("--backup-dir", required=True, type=Path)
args = parser.parse_args()
source = args.database.resolve(strict=True)
env_path = args.env.resolve(strict=True)
if not env_path.is_file():
    raise SystemExit("Environment path must be an existing file.")
args.backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as db:
    if db.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
        raise SystemExit("Source SQLite check failed. No configuration was changed.")
    ids = {}
    for name in ("Emirgan",):
        rows = db.execute("SELECT id, username FROM users WHERE lower(username)=lower(?)", (name,)).fetchall()
        if len(rows) != 1 or not isinstance(rows[0][0], int) or rows[0][0] <= 0:
            raise SystemExit(f"Could not uniquely resolve the existing {name} account.")
        ids[name] = rows[0][0]
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='private_uni_owner'").fetchone():
        pinned = db.execute("SELECT user_id FROM private_uni_owner WHERE singleton=1").fetchone()
        if pinned and pinned[0] != ids["Emirgan"]:
            raise SystemExit("The pinned owner differs. Stop and verify the existing account.")
    directory = Path(tempfile.mkdtemp(prefix="university-", dir=args.backup_dir))
    backup = directory / "local.db"
    with sqlite3.connect(backup) as dst:
        db.backup(dst)
        if dst.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise SystemExit("Backup integrity check failed. No configuration was changed.")
    backup.chmod(0o600)
content = env_path.read_text()
for name, user_id in ids.items():
    key = "KAPSAPP_UNIVERSITY_" + name.upper() + "_ID"
    old = re.search(r"(?m)^" + key + r"=(.*)$", content)
    if old and old.group(1).strip() not in ("", str(user_id)):
        raise SystemExit(f"{key} already has a different identity. Configuration was kept.")
    content = re.sub(r"(?m)^" + key + r"=.*\n?", "", content).rstrip() + f"\n{key}={user_id}\n"
stat = env_path.stat()
handle, temporary = tempfile.mkstemp(prefix=".university-env-", dir=env_path.parent)
try:
    with os.fdopen(handle, "w") as out:
        out.write(content)
        out.flush()
        os.fsync(out.fileno())
    os.chmod(temporary, stat.st_mode & 0o777)
    if os.geteuid() == 0:
        os.chown(temporary, stat.st_uid, stat.st_gid)
    os.replace(temporary, env_path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print(f"Verified SQLite backup: {backup}")
for name, user_id in ids.items():
    print(f"{name} ID: {user_id}")
print("Saved the verified Emirgan ID. Restart the existing application after the new code is deployed.")
