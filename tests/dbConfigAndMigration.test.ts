import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@libsql/client";
import {
  DEFAULT_PRODUCTION_DATA_DIR,
  DEFAULT_PRODUCTION_DB_FILENAME,
  resolveDatabaseConfig,
  assertSafeDatabaseConfig,
  configureSqliteRuntime,
  closeDatabaseGracefully,
  findGitRoot,
} from "../src/server/dbConfig";
// @ts-ignore Plain ESM script exports
import { migrateSqliteDatabase, inspectSqliteSnapshot } from "../scripts/migrate-sqlite-db.mjs";
// @ts-ignore Plain ESM script exports
import {
  findForbiddenDbFiles,
  checkGitRepositoryForSqliteFiles,
} from "../scripts/check-no-tracked-db.mjs";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("resolveDatabaseConfig honors strict env precedence and production defaults", () => {
  const cwd = "/srv/kapsapp";

  // 1. Remote TURSO_DATABASE_URL wins over everything
  const remote = resolveDatabaseConfig({
    cwd,
    env: {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://kapsapp-prod.turso.io",
      TURSO_AUTH_TOKEN: "secret-token",
      DATABASE_PATH: "/var/lib/kapsapp/kapsapp.db",
      KAPSAPP_DATA_DIR: "/var/lib/kapsapp",
    },
  });
  assert.equal(remote.kind, "remote");
  assert.equal(remote.url, "libsql://kapsapp-prod.turso.io");
  assert.equal(remote.filePath, null);
  assert.equal(remote.source, "TURSO_DATABASE_URL");
  assert.equal(remote.authToken, "secret-token");

  // 2. Explicit file: URI in TURSO_DATABASE_URL resolves to absolute path
  const fileUri = resolveDatabaseConfig({
    cwd,
    env: {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "file:/var/lib/kapsapp/custom.db",
    },
  });
  assert.equal(fileUri.kind, "local-file");
  assert.equal(fileUri.filePath, "/var/lib/kapsapp/custom.db");
  assert.equal(fileUri.url, "file:/var/lib/kapsapp/custom.db");
  assert.equal(fileUri.source, "TURSO_DATABASE_URL");

  // 3. DATABASE_PATH overrides KAPSAPP_DATA_DIR
  const dbPath = resolveDatabaseConfig({
    cwd,
    env: {
      NODE_ENV: "production",
      DATABASE_PATH: "/var/lib/kapsapp/prod-main.db",
      KAPSAPP_DATA_DIR: "/var/lib/kapsapp",
    },
  });
  assert.equal(dbPath.kind, "local-file");
  assert.equal(dbPath.filePath, "/var/lib/kapsapp/prod-main.db");
  assert.equal(dbPath.source, "DATABASE_PATH");

  // 4. KAPSAPP_DB_PATH alias works
  const aliasPath = resolveDatabaseConfig({
    cwd,
    env: {
      NODE_ENV: "production",
      KAPSAPP_DB_PATH: "/mnt/data/kaps.db",
    },
  });
  assert.equal(aliasPath.filePath, "/mnt/data/kaps.db");
  assert.equal(aliasPath.source, "KAPSAPP_DB_PATH");

  // 5. KAPSAPP_DATA_DIR resolves to <dir>/kapsapp.db
  const dataDir = resolveDatabaseConfig({
    cwd,
    env: {
      NODE_ENV: "production",
      KAPSAPP_DATA_DIR: "/var/lib/kapsapp",
    },
  });
  assert.equal(dataDir.filePath, "/var/lib/kapsapp/kapsapp.db");
  assert.equal(dataDir.source, "KAPSAPP_DATA_DIR");

  // 6. Production default without env vars resolves to /var/lib/kapsapp/kapsapp.db
  const prodDefault = resolveDatabaseConfig({
    cwd,
    env: { NODE_ENV: "production" },
  });
  assert.equal(
    prodDefault.filePath,
    path.join(DEFAULT_PRODUCTION_DATA_DIR, DEFAULT_PRODUCTION_DB_FILENAME)
  );
  assert.equal(prodDefault.source, "production-default");

  // 7. Development default resolves to <cwd>/local.db
  const devDefault = resolveDatabaseConfig({
    cwd,
    env: { NODE_ENV: "development" },
  });
  assert.equal(devDefault.filePath, path.join(cwd, "local.db"));
  assert.equal(devDefault.source, "development-default");

  // 8. In-memory DB supported
  const mem = resolveDatabaseConfig({
    cwd,
    env: { NODE_ENV: "test", TURSO_DATABASE_URL: ":memory:" },
  });
  assert.equal(mem.kind, "memory");
  assert.equal(mem.filePath, null);
});

test("assertSafeDatabaseConfig blocks production DB inside Git repo and unmigrated legacy local.db", () => {
  const base = makeTempDir("kaps-guard-");
  try {
    const repoDir = path.join(base, "repo");
    const persistentDir = path.join(base, "persistent");
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });
    fs.mkdirSync(persistentDir, { recursive: true });

    assert.equal(findGitRoot(repoDir), repoDir);
    assert.equal(findGitRoot(persistentDir), null);

    // Block production DB inside a Git working directory
    const inRepoConfig = resolveDatabaseConfig({
      cwd: repoDir,
      env: {
        NODE_ENV: "production",
        DATABASE_PATH: path.join(repoDir, "local.db"),
      },
    });
    assert.throws(
      () => assertSafeDatabaseConfig(inRepoConfig, { cwd: repoDir, env: { NODE_ENV: "production" } }),
      /inside Git repository/
    );

    // Block booting an empty production DB when unmigrated legacy ./local.db exists
    const legacyDb = path.join(repoDir, "local.db");
    fs.writeFileSync(legacyDb, "non-empty-legacy-placeholder");
    const unmigratedConfig = resolveDatabaseConfig({
      cwd: repoDir,
      env: {
        NODE_ENV: "production",
        DATABASE_PATH: path.join(persistentDir, "kapsapp.db"),
      },
    });
    assert.throws(
      () =>
        assertSafeDatabaseConfig(unmigratedConfig, {
          cwd: repoDir,
          env: { NODE_ENV: "production" },
        }),
      /unmigrated legacy database/
    );

    // Succeed once the persistent DB exists and is non-empty
    fs.writeFileSync(path.join(persistentDir, "kapsapp.db"), "migrated-db-content");
    assert.doesNotThrow(() =>
      assertSafeDatabaseConfig(unmigratedConfig, {
        cwd: repoDir,
        env: { NODE_ENV: "production" },
      })
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("configureSqliteRuntime enforces WAL mode and catches corrupted SQLite files without overwriting", async () => {
  const base = makeTempDir("kaps-runtime-");
  try {
    const validDbPath = path.join(base, "valid.db");
    const validConfig = resolveDatabaseConfig({
      cwd: base,
      env: { NODE_ENV: "development", DATABASE_PATH: validDbPath },
    });
    const client = createClient({ url: validConfig.url });
    try {
      await configureSqliteRuntime(client, validConfig);
      const modeRes = await client.execute("PRAGMA journal_mode;");
      assert.equal(String(Object.values(modeRes.rows[0])[0]).toLowerCase(), "wal");
    } finally {
      await closeDatabaseGracefully(client, validConfig);
    }

    // Create a deliberately corrupted database file and confirm integrity error without overwriting
    const corruptPath = path.join(base, "corrupt.db");
    const corruptBytes = Buffer.from("THIS IS NOT A VALID SQLITE DATABASE HEADER" + "x".repeat(4096));
    fs.writeFileSync(corruptPath, corruptBytes);
    const corruptConfig = resolveDatabaseConfig({
      cwd: base,
      env: { NODE_ENV: "development", DATABASE_PATH: corruptPath },
    });
    const corruptClient = createClient({ url: corruptConfig.url });
    try {
      await assert.rejects(() => configureSqliteRuntime(corruptClient, corruptConfig));
    } finally {
      corruptClient.close();
    }
    assert.deepEqual(fs.readFileSync(corruptPath), corruptBytes, "Corrupt file must never be auto-overwritten");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("migrateSqliteDatabase preserves committed WAL transactions, verifies backup/target, and never overwrites", async () => {
  const base = makeTempDir("kaps-migrate-");
  try {
    const repoDir = path.join(base, "repo");
    const dataDir = path.join(base, "var-lib-kapsapp");
    const backupDir = path.join(dataDir, "backups");
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });

    const sourceDb = path.join(repoDir, "local.db");
    const targetDb = path.join(dataDir, "kapsapp.db");

    // Populate source DB in WAL mode and keep uncheckpointed WAL transactions
    const seedClient = createClient({ url: `file:${sourceDb}` });
    try {
      await seedClient.execute("PRAGMA journal_mode = WAL;");
      await seedClient.execute("PRAGMA wal_autocheckpoint = 0;");
      await seedClient.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL);");
      await seedClient.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY, body TEXT NOT NULL);");
      await seedClient.execute("CREATE TABLE strike_inventory (id INTEGER PRIMARY KEY, skin TEXT NOT NULL);");
      await seedClient.execute("CREATE TABLE german_progress (id INTEGER PRIMARY KEY, word TEXT NOT NULL, score INTEGER);");

      await seedClient.execute("INSERT INTO users (username) VALUES ('Emirgan'), ('Dido');");
      await seedClient.execute("INSERT INTO messages (body) VALUES ('hello from wal 1'), ('hello from wal 2');");
      await seedClient.execute("INSERT INTO strike_inventory (skin) VALUES ('ak47-asiimov');");
      await seedClient.execute("INSERT INTO german_progress (word, score) VALUES ('der Tisch', 95);");

      // Confirm WAL file actually holds committed frames before migration
      assert.equal(fs.existsSync(`${sourceDb}-wal`), true, "Expected active WAL file");
      assert.ok(fs.statSync(`${sourceDb}-wal`).size > 0, "Expected non-empty WAL frames");
    } finally {
      // Close without truncating WAL manually (simulating a stopped server with uncheckpointed WAL)
      seedClient.close();
    }

    const quietLogger = { log: () => {}, warn: () => {}, error: () => {} } as unknown as Console;

    // Refuse migrating into a Git working directory
    await assert.rejects(
      () =>
        migrateSqliteDatabase({
          sourcePath: sourceDb,
          targetPath: path.join(repoDir, "still-in-git.db"),
          backupDir,
          allowActiveWriters: true,
          logger: quietLogger,
        }),
      /inside Git repository/
    );

    // Run verified WAL-preserving migration to persistent dataDir
    const result = await migrateSqliteDatabase({
      sourcePath: sourceDb,
      targetPath: targetDb,
      backupDir,
      allowActiveWriters: true,
      logger: quietLogger,
    });

    assert.equal(result.dryRun, false);
    assert.equal(result.targetPath, targetDb);
    assert.ok(result.backupPath && fs.existsSync(result.backupPath), "Verified backup must exist");
    assert.equal(fs.existsSync(targetDb), true, "Migrated target DB must exist");
    assert.equal(fs.existsSync(sourceDb), true, "Original source DB must not be deleted");

    // Verify exact row counts and integrity on BOTH backup and migrated target
    const targetSnap = await inspectSqliteSnapshot(targetDb);
    const backupSnap = await inspectSqliteSnapshot(result.backupPath);
    assert.equal(targetSnap.integrityOk, true);
    assert.equal(backupSnap.integrityOk, true);
    assert.deepEqual(targetSnap.tableCounts, {
      german_progress: 1,
      messages: 2,
      strike_inventory: 1,
      users: 2,
    });
    assert.deepEqual(backupSnap.tableCounts, targetSnap.tableCounts);

    // Verify actual WAL-committed record values made it into targetDb
    const verifyClient = createClient({ url: `file:${targetDb}` });
    try {
      const msgRes = await verifyClient.execute("SELECT body FROM messages ORDER BY id;");
      assert.deepEqual(
        msgRes.rows.map((r) => r.body),
        ["hello from wal 1", "hello from wal 2"]
      );
      const germanRes = await verifyClient.execute("SELECT word, score FROM german_progress;");
      assert.equal(germanRes.rows[0].word, "der Tisch");
      assert.equal(Number(germanRes.rows[0].score), 95);
    } finally {
      verifyClient.close();
    }

    // Re-running migration must refuse to overwrite existing target DB
    await assert.rejects(
      () =>
        migrateSqliteDatabase({
          sourcePath: sourceDb,
          targetPath: targetDb,
          backupDir,
          allowActiveWriters: true,
          logger: quietLogger,
        }),
      /Refusing to overwrite existing target database/
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("Git SQLite tracking guard rejects runtime database files and allows clean commits", () => {
  const sample = [
    "server.ts",
    "src/server/dbConfig.ts",
    ".gitignore",
    "local.db",
    "local.db-wal",
    "local.db-shm",
    "local.db-journal",
    "data/kapsapp.db",
    "tmp/test.sqlite3",
    "tmp/test.sqlite3-wal",
  ];
  assert.deepEqual(findForbiddenDbFiles(sample), [
    "data/kapsapp.db",
    "local.db",
    "local.db-journal",
    "local.db-shm",
    "local.db-wal",
    "tmp/test.sqlite3",
    "tmp/test.sqlite3-wal",
  ]);

  // Real temporary Git repository verification
  const repo = makeTempDir("kaps-git-guard-");
  try {
    execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
    fs.writeFileSync(path.join(repo, "app.ts"), "export const ok = true;\n");
    execFileSync("git", ["add", "app.ts"], { cwd: repo, stdio: "ignore" });

    const clean = checkGitRepositoryForSqliteFiles({ cwd: repo, strictGit: true });
    assert.equal(clean.ok, true);
    assert.deepEqual(clean.violations, []);

    fs.writeFileSync(path.join(repo, "local.db"), "sqlite-placeholder");
    fs.writeFileSync(path.join(repo, "local.db-wal"), "wal-placeholder");
    execFileSync("git", ["add", "-f", "local.db", "local.db-wal"], { cwd: repo, stdio: "ignore" });

    const dirty = checkGitRepositoryForSqliteFiles({ cwd: repo, stagedOnly: true, strictGit: true });
    assert.equal(dirty.ok, false);
    assert.deepEqual(dirty.violations, ["local.db", "local.db-wal"]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("Static audit: no stray hardcoded file:local.db connections exist in server or scripts", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const filesToAudit = [
    path.join(root, "server.ts"),
    path.join(root, "scripts", "import-physics-ia.ts"),
    path.join(root, "scripts", "list-tables.js"),
    path.join(root, "scripts", "update-password.js"),
  ];
  for (const filePath of filesToAudit) {
    const content = fs.readFileSync(filePath, "utf8");
    assert.equal(
      /["']file:local\.db["']/.test(content),
      false,
      `Found hardcoded file:local.db in ${path.relative(root, filePath)}`
    );
  }
});
