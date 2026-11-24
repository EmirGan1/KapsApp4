#!/usr/bin/env node
/**
 * Safe, verified, WAL-preserving one-time SQLite migration script for KapsApp.
 *
 * Moves a legacy in-repo SQLite database (e.g. /var/www/KapsApp/local.db + WAL/SHM)
 * to a persistent data directory outside Git (default: /var/lib/kapsapp/kapsapp.db)
 * while:
 *   1. Refusing to run while database writers (PM2 / Node processes) are active.
 *   2. Never overwriting, resetting, or deleting an existing production database.
 *   3. Checkpointing committed WAL transactions (PRAGMA wal_checkpoint(TRUNCATE)).
 *   4. Creating a verified standalone SQLite backup via VACUUM INTO + integrity_check.
 *   5. Writing to an atomic staging file on the target filesystem, verifying
 *      PRAGMA integrity_check and exact per-table row counts, then renaming into place.
 *   6. Leaving the original source file intact (never deleting production data).
 *
 * Usage:
 *   node scripts/migrate-sqlite-db.mjs \
 *     --source /var/www/KapsApp/local.db \
 *     --target /var/lib/kapsapp/kapsapp.db \
 *     --backup-dir /var/lib/kapsapp/backups
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import {
  DEFAULT_PRODUCTION_DATA_DIR,
  DEFAULT_PRODUCTION_DB_FILENAME,
  findGitRoot,
} from "./lib/db-url.mjs";

function quoteSqlIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function formatUtcTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Inspects Linux /proc/<pid>/fd and PM2 process list (best-effort) to detect
 * any active process holding open file descriptors to the source database or
 * running `kapsapp-production`.
 */
export function detectActiveDatabaseWriters(sourcePath) {
  const resolvedSource = path.resolve(sourcePath);
  const trackedFiles = new Set([
    resolvedSource,
    `${resolvedSource}-wal`,
    `${resolvedSource}-shm`,
    `${resolvedSource}-journal`,
  ]);
  const writers = [];

  // 1. Check Linux /proc/<pid>/fd for open handles on source DB/WAL/SHM
  if (fs.existsSync("/proc")) {
    let entries = [];
    try {
      entries = fs.readdirSync("/proc");
    } catch {
      entries = [];
    }
    const selfPid = String(process.pid);
    for (const pid of entries) {
      if (!/^\d+$/.test(pid) || pid === selfPid) continue;
      const fdDir = `/proc/${pid}/fd`;
      let fds;
      try {
        fds = fs.readdirSync(fdDir);
      } catch {
        continue;
      }
      for (const fd of fds) {
        let target;
        try {
          target = fs.readlinkSync(path.join(fdDir, fd));
        } catch {
          continue;
        }
        const cleanedTarget = target.replace(/ \(deleted\)$/, "");
        if (trackedFiles.has(cleanedTarget)) {
          let cmdline = "";
          try {
            cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
          } catch {}
          writers.push({
            kind: "open-fd",
            pid: Number(pid),
            file: cleanedTarget,
            command: cmdline || `pid:${pid}`,
          });
          break;
        }
      }
    }
  }

  // 2. Check PM2 for online kapsapp processes
  try {
    const raw = execFileSync("pm2", ["jlist"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      for (const proc of list) {
        const name = String(proc?.name || "");
        const status = String(proc?.pm2_env?.status || "");
        const script = String(proc?.pm2_env?.pm_exec_path || "");
        const isKapsApp =
          /kapsapp/i.test(name) ||
          /server\.(cjs|ts|js)$/i.test(script);
        if (isKapsApp && status === "online") {
          writers.push({
            kind: "pm2-online",
            pid: Number(proc?.pid || 0),
            file: script || name,
            command: `pm2:${name} (status=${status})`,
          });
        }
      }
    }
  } catch {
    // pm2 not installed or daemon not running
  }

  return writers;
}

export async function inspectSqliteSnapshot(filePath) {
  const resolved = path.resolve(filePath);
  const client = createClient({ url: `file:${resolved}` });
  try {
    await client.execute("PRAGMA busy_timeout = 5000;");
    const integrityRes = await client.execute("PRAGMA integrity_check;");
    const integrityRows = integrityRes.rows.map((row) => String(Object.values(row)[0] ?? ""));
    const integrityOk = integrityRows.length === 1 && integrityRows[0].toLowerCase() === "ok";

    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const tableCounts = {};
    for (const row of tablesRes.rows) {
      const tableName = String(row.name);
      const countRes = await client.execute(`SELECT COUNT(*) AS count FROM ${quoteSqlIdent(tableName)};`);
      tableCounts[tableName] = Number(countRes.rows[0]?.count ?? 0);
    }

    return {
      filePath: resolved,
      integrityOk,
      integrityRows,
      tableCounts,
      totalTables: Object.keys(tableCounts).length,
      totalRows: Object.values(tableCounts).reduce((sum, n) => sum + n, 0),
    };
  } finally {
    client.close();
  }
}

function assertSnapshotsMatch(label, expected, actual) {
  if (!actual.integrityOk) {
    throw new Error(
      `[MIGRATION ABORTED] ${label} failed PRAGMA integrity_check: ${actual.integrityRows.join("; ")}`
    );
  }
  const expectedKeys = Object.keys(expected.tableCounts).sort();
  const actualKeys = Object.keys(actual.tableCounts).sort();
  if (expectedKeys.length !== actualKeys.length) {
    throw new Error(
      `[MIGRATION ABORTED] ${label} table count mismatch (expected ${expectedKeys.length}, got ${actualKeys.length}).`
    );
  }
  for (let i = 0; i < expectedKeys.length; i++) {
    const key = expectedKeys[i];
    if (key !== actualKeys[i]) {
      throw new Error(`[MIGRATION ABORTED] ${label} table list mismatch at ${key} vs ${actualKeys[i]}.`);
    }
    if (expected.tableCounts[key] !== actual.tableCounts[key]) {
      throw new Error(
        `[MIGRATION ABORTED] ${label} row count mismatch for table "${key}" ` +
          `(expected ${expected.tableCounts[key]}, got ${actual.tableCounts[key]}).`
      );
    }
  }
}

export async function migrateSqliteDatabase({
  sourcePath,
  targetPath,
  backupDir,
  allowActiveWriters = false,
  allowTargetInGitRepo = false,
  dryRun = false,
  logger = console,
}) {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBackupDir = path.resolve(backupDir || path.join(path.dirname(resolvedTarget), "backups"));

  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`[MIGRATION ABORTED] Source database does not exist: ${resolvedSource}`);
  }
  const sourceStat = fs.statSync(resolvedSource);
  if (!sourceStat.isFile() || sourceStat.size === 0) {
    throw new Error(`[MIGRATION ABORTED] Source database is missing or empty: ${resolvedSource}`);
  }

  if (resolvedSource === resolvedTarget) {
    throw new Error(`[MIGRATION ABORTED] Source and target paths are identical: ${resolvedSource}`);
  }

  if (fs.existsSync(resolvedTarget)) {
    throw new Error(
      `[MIGRATION ABORTED] Refusing to overwrite existing target database: ${resolvedTarget}. ` +
        `Production databases are never overwritten or deleted automatically.`
    );
  }

  if (!allowTargetInGitRepo) {
    const targetGitRoot = findGitRoot(path.dirname(resolvedTarget));
    if (targetGitRoot !== null) {
      throw new Error(
        `[MIGRATION ABORTED] Target database ${resolvedTarget} is inside Git repository ${targetGitRoot}. ` +
          `Choose a persistent directory outside Git (e.g. ${DEFAULT_PRODUCTION_DATA_DIR}/${DEFAULT_PRODUCTION_DB_FILENAME}).`
      );
    }
  }

  if (!allowActiveWriters) {
    const activeWriters = detectActiveDatabaseWriters(resolvedSource);
    if (activeWriters.length > 0) {
      const details = activeWriters
        .map((w) => `  - [${w.kind}] pid=${w.pid} (${w.command}) -> ${w.file}`)
        .join("\n");
      throw new Error(
        `[MIGRATION ABORTED] Active database writer(s) detected:\n${details}\n` +
          `Stop all writers before migrating (e.g. "pm2 stop kapsapp-production") and re-run.`
      );
    }
  }

  const walExists = fs.existsSync(`${resolvedSource}-wal`);
  const walSize = walExists ? fs.statSync(`${resolvedSource}-wal`).size : 0;
  logger.log(`[MIGRATION] Source: ${resolvedSource} (${sourceStat.size} bytes, WAL=${walSize} bytes)`);
  logger.log(`[MIGRATION] Target: ${resolvedTarget}`);
  logger.log(`[MIGRATION] Backup dir: ${resolvedBackupDir}`);

  if (dryRun) {
    const snapshot = await inspectSqliteSnapshot(resolvedSource);
    if (!snapshot.integrityOk) {
      throw new Error(
        `[MIGRATION DRY-RUN FAILED] Source PRAGMA integrity_check failed: ${snapshot.integrityRows.join("; ")}`
      );
    }
    logger.log(
      `[MIGRATION DRY-RUN OK] Source integrity=ok, tables=${snapshot.totalTables}, totalRows=${snapshot.totalRows}. No files were modified.`
    );
    return {
      dryRun: true,
      sourcePath: resolvedSource,
      targetPath: resolvedTarget,
      backupPath: null,
      sourceSnapshot: snapshot,
      targetSnapshot: null,
    };
  }

  fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true, mode: 0o750 });
  fs.mkdirSync(resolvedBackupDir, { recursive: true, mode: 0o700 });

  const timestamp = formatUtcTimestamp();
  const backupPath = path.join(resolvedBackupDir, `pre-migration-${timestamp}.db`);
  if (fs.existsSync(backupPath)) {
    throw new Error(`[MIGRATION ABORTED] Backup path already exists: ${backupPath}`);
  }
  const stagedTargetPath = path.join(
    path.dirname(resolvedTarget),
    `.${path.basename(resolvedTarget)}.migrating-${process.pid}-${Date.now()}.tmp`
  );

  let sourceClient = null;
  let stagedCreated = false;

  try {
    sourceClient = createClient({ url: `file:${resolvedSource}` });
    await sourceClient.execute("PRAGMA busy_timeout = 5000;");

    // 1. Flush all committed WAL transactions into the main DB file
    const checkpointRes = await sourceClient.execute("PRAGMA wal_checkpoint(TRUNCATE);");
    const cpRow = checkpointRes.rows[0] ? Object.values(checkpointRes.rows[0]) : [0, 0, 0];
    const cpBusy = Number(cpRow[0] ?? 0);
    const cpLog = Number(cpRow[1] ?? 0);
    const cpCheckpointed = Number(cpRow[2] ?? 0);
    logger.log(
      `[MIGRATION] WAL checkpoint(TRUNCATE): busy=${cpBusy}, logFrames=${cpLog}, checkpointed=${cpCheckpointed}`
    );
    if (cpBusy !== 0) {
      throw new Error(
        `[MIGRATION ABORTED] WAL checkpoint could not acquire exclusive lock (busy=${cpBusy}). ` +
          `Ensure all processes using ${resolvedSource} are stopped.`
      );
    }

    // 2. Verify source integrity & capture exact table/row counts
    const sourceSnapshot = await inspectSqliteSnapshot(resolvedSource);
    if (!sourceSnapshot.integrityOk) {
      throw new Error(
        `[MIGRATION ABORTED] Source database failed PRAGMA integrity_check: ${sourceSnapshot.integrityRows.join("; ")}`
      );
    }
    logger.log(
      `[MIGRATION] Source integrity=ok (${sourceSnapshot.totalTables} tables, ${sourceSnapshot.totalRows} total rows)`
    );

    // 3. Create verified standalone backup via SQLite VACUUM INTO
    await sourceClient.execute({ sql: "VACUUM INTO ?;", args: [backupPath] });
    fs.chmodSync(backupPath, 0o600);
    const backupSnapshot = await inspectSqliteSnapshot(backupPath);
    assertSnapshotsMatch("Backup database", sourceSnapshot, backupSnapshot);
    logger.log(`[MIGRATION] Verified backup created: ${backupPath}`);

    // 4. Write atomic staged copy at target filesystem via VACUUM INTO
    stagedCreated = true;
    await sourceClient.execute({ sql: "VACUUM INTO ?;", args: [stagedTargetPath] });

    // Close source before finalizing target
    sourceClient.close();
    sourceClient = null;

    // 5. Verify staged standalone copy (integrity + exact row counts) BEFORE atomic rename
    const stagedSnapshot = await inspectSqliteSnapshot(stagedTargetPath);
    assertSnapshotsMatch("Staged target database", sourceSnapshot, stagedSnapshot);
    fs.chmodSync(stagedTargetPath, 0o640);

    // Final non-overwrite guard right before atomic rename
    if (fs.existsSync(resolvedTarget)) {
      throw new Error(
        `[MIGRATION ABORTED] Target database appeared concurrently at ${resolvedTarget}; refusing to overwrite.`
      );
    }

    fs.renameSync(stagedTargetPath, resolvedTarget);
    stagedCreated = false;

    // 6. Enable WAL mode at the final target path and run final verification pass
    const targetClient = createClient({ url: `file:${resolvedTarget}` });
    try {
      await targetClient.execute("PRAGMA busy_timeout = 5000;");
      await targetClient.execute("PRAGMA journal_mode = WAL;");
      await targetClient.execute("PRAGMA synchronous = NORMAL;");
      await targetClient.execute("PRAGMA wal_checkpoint(TRUNCATE);");
    } finally {
      targetClient.close();
    }

    const targetSnapshot = await inspectSqliteSnapshot(resolvedTarget);
    assertSnapshotsMatch("Migrated target database", sourceSnapshot, targetSnapshot);
    logger.log(
      `[MIGRATION SUCCESS] Target ready & verified: ${resolvedTarget} ` +
        `(${targetSnapshot.totalTables} tables, ${targetSnapshot.totalRows} rows)`
    );
    logger.log(`[MIGRATION NOTE] Original source left untouched at: ${resolvedSource}`);

    return {
      dryRun: false,
      sourcePath: resolvedSource,
      targetPath: resolvedTarget,
      backupPath,
      sourceSnapshot,
      backupSnapshot,
      targetSnapshot,
    };
  } catch (err) {
    if (stagedCreated && fs.existsSync(stagedTargetPath)) {
      try {
        fs.unlinkSync(stagedTargetPath);
      } catch {}
    }
    throw err;
  } finally {
    if (sourceClient) {
      try {
        sourceClient.close();
      } catch {}
    }
  }
}

function parseCliArgs(argv) {
  const defaultTarget =
    process.env.DATABASE_PATH?.trim() ||
    process.env.KAPSAPP_DB_PATH?.trim() ||
    path.join(
      process.env.KAPSAPP_DATA_DIR?.trim() || DEFAULT_PRODUCTION_DATA_DIR,
      DEFAULT_PRODUCTION_DB_FILENAME
    );

  const opts = {
    sourcePath: path.resolve(process.cwd(), "local.db"),
    targetPath: path.resolve(defaultTarget),
    backupDir: undefined,
    allowActiveWriters: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--source" && argv[i + 1]) {
      opts.sourcePath = path.resolve(argv[++i]);
    } else if (arg === "--target" && argv[i + 1]) {
      opts.targetPath = path.resolve(argv[++i]);
    } else if (arg === "--backup-dir" && argv[i + 1]) {
      opts.backupDir = path.resolve(argv[++i]);
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--allow-active-writers") {
      opts.allowActiveWriters = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/migrate-sqlite-db.mjs [--source <path>] [--target <path>] [--backup-dir <dir>] [--dry-run]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

const isCliEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntry) {
  const opts = parseCliArgs(process.argv.slice(2));
  migrateSqliteDatabase(opts).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
