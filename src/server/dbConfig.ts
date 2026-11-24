import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

export const DEFAULT_PRODUCTION_DATA_DIR = "/var/lib/kapsapp";
export const DEFAULT_PRODUCTION_DB_FILENAME = "kapsapp.db";
export const DEFAULT_DEV_DB_FILENAME = "local.db";

export type DatabaseKind = "remote" | "memory" | "local-file";

export type DatabaseConfigSource =
  | "TURSO_DATABASE_URL"
  | "LIBSQL_URL"
  | "DATABASE_PATH"
  | "KAPSAPP_DB_PATH"
  | "SQLITE_DB_PATH"
  | "KAPSAPP_DATA_DIR"
  | "DATA_DIR"
  | "production-default"
  | "development-default";

export interface ResolvedDatabaseConfig {
  kind: DatabaseKind;
  url: string;
  filePath: string | null;
  authToken?: string;
  source: DatabaseConfigSource;
  isProduction: boolean;
}

export interface ResolveDatabaseOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

const REMOTE_URL_PATTERN = /^(libsql|https?|wss?):\/\//i;

function readNonEmptyEnv(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = env[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMemorySpecifier(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === ":memory:" ||
    normalized === "file::memory:" ||
    normalized.startsWith("file::memory:?")
  );
}

function parseFileSpecifier(specifier: string, cwd: string): { filePath: string; url: string } {
  let raw = specifier.trim();
  let querySuffix = "";

  if (raw.toLowerCase().startsWith("file:")) {
    raw = raw.slice(5);
    const queryIndex = raw.indexOf("?");
    if (queryIndex !== -1) {
      querySuffix = raw.slice(queryIndex);
      raw = raw.slice(0, queryIndex);
    }
    if (raw.startsWith("//localhost/")) {
      raw = raw.slice("//localhost".length);
    } else if (raw.startsWith("///")) {
      raw = raw.slice(2);
    }
    try {
      raw = decodeURIComponent(raw);
    } catch {
      // Keep raw path if not percent-encoded
    }
  }

  if (!raw) {
    throw new Error("Database file path cannot be empty.");
  }

  const filePath = path.resolve(cwd, raw);
  return {
    filePath,
    url: `file:${filePath}${querySuffix}`,
  };
}

/**
 * Resolves the canonical database connection configuration used across the
 * server and all operational scripts.
 *
 * Precedence:
 *  1. TURSO_DATABASE_URL / LIBSQL_URL (remote libsql/https OR explicit file: URI / :memory:)
 *  2. DATABASE_PATH / KAPSAPP_DB_PATH / SQLITE_DB_PATH (explicit SQLite file path)
 *  3. KAPSAPP_DATA_DIR / DATA_DIR (persistent data dir -> <dir>/kapsapp.db)
 *  4. NODE_ENV === "production" default -> /var/lib/kapsapp/kapsapp.db
 *  5. Development / test default -> <cwd>/local.db (gitignored)
 */
export function resolveDatabaseConfig(options: ResolveDatabaseOptions = {}): ResolvedDatabaseConfig {
  const env = options.env ?? process.env;
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const isProduction = env.NODE_ENV === "production";
  const authToken = readNonEmptyEnv(env, "TURSO_AUTH_TOKEN") ?? readNonEmptyEnv(env, "LIBSQL_AUTH_TOKEN") ?? undefined;

  const urlCandidates: Array<{ key: "TURSO_DATABASE_URL" | "LIBSQL_URL"; value: string | null }> = [
    { key: "TURSO_DATABASE_URL", value: readNonEmptyEnv(env, "TURSO_DATABASE_URL") },
    { key: "LIBSQL_URL", value: readNonEmptyEnv(env, "LIBSQL_URL") },
  ];

  for (const candidate of urlCandidates) {
    if (!candidate.value) continue;
    if (isMemorySpecifier(candidate.value)) {
      return {
        kind: "memory",
        url: candidate.value,
        filePath: null,
        authToken,
        source: candidate.key,
        isProduction,
      };
    }
    if (REMOTE_URL_PATTERN.test(candidate.value)) {
      return {
        kind: "remote",
        url: candidate.value,
        filePath: null,
        authToken,
        source: candidate.key,
        isProduction,
      };
    }
    const parsed = parseFileSpecifier(candidate.value, cwd);
    return {
      kind: "local-file",
      url: parsed.url,
      filePath: parsed.filePath,
      authToken,
      source: candidate.key,
      isProduction,
    };
  }

  const filePathCandidates: Array<{
    key: "DATABASE_PATH" | "KAPSAPP_DB_PATH" | "SQLITE_DB_PATH";
    value: string | null;
  }> = [
    { key: "DATABASE_PATH", value: readNonEmptyEnv(env, "DATABASE_PATH") },
    { key: "KAPSAPP_DB_PATH", value: readNonEmptyEnv(env, "KAPSAPP_DB_PATH") },
    { key: "SQLITE_DB_PATH", value: readNonEmptyEnv(env, "SQLITE_DB_PATH") },
  ];

  for (const candidate of filePathCandidates) {
    if (!candidate.value) continue;
    if (isMemorySpecifier(candidate.value)) {
      return {
        kind: "memory",
        url: candidate.value,
        filePath: null,
        authToken,
        source: candidate.key,
        isProduction,
      };
    }
    const parsed = parseFileSpecifier(candidate.value, cwd);
    return {
      kind: "local-file",
      url: parsed.url,
      filePath: parsed.filePath,
      authToken,
      source: candidate.key,
      isProduction,
    };
  }

  const dataDirCandidates: Array<{ key: "KAPSAPP_DATA_DIR" | "DATA_DIR"; value: string | null }> = [
    { key: "KAPSAPP_DATA_DIR", value: readNonEmptyEnv(env, "KAPSAPP_DATA_DIR") },
    { key: "DATA_DIR", value: readNonEmptyEnv(env, "DATA_DIR") },
  ];

  for (const candidate of dataDirCandidates) {
    if (!candidate.value) continue;
    const resolvedDir = path.resolve(cwd, candidate.value);
    const filePath = path.join(resolvedDir, DEFAULT_PRODUCTION_DB_FILENAME);
    return {
      kind: "local-file",
      url: `file:${filePath}`,
      filePath,
      authToken,
      source: candidate.key,
      isProduction,
    };
  }

  if (isProduction) {
    const filePath = path.join(DEFAULT_PRODUCTION_DATA_DIR, DEFAULT_PRODUCTION_DB_FILENAME);
    return {
      kind: "local-file",
      url: `file:${filePath}`,
      filePath,
      authToken,
      source: "production-default",
      isProduction,
    };
  }

  const filePath = path.resolve(cwd, DEFAULT_DEV_DB_FILENAME);
  return {
    kind: "local-file",
    url: `file:${filePath}`,
    filePath,
    authToken,
    source: "development-default",
    isProduction,
  };
}

/**
 * Walks upward from `startDir` to determine whether the path resides inside a
 * Git working directory (directory or worktree containing `.git`).
 */
export function findGitRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function getExistingNonEmptySize(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Validates that production SQLite files are separated from Git working
 * directories and never silently initialize an empty database when an
 * unmigrated legacy `local.db` is present in the checkout.
 */
export function assertSafeDatabaseConfig(
  config: ResolvedDatabaseConfig,
  options: ResolveDatabaseOptions = {}
): void {
  if (!config.isProduction || config.kind !== "local-file" || !config.filePath) {
    return;
  }

  const env = options.env ?? process.env;
  const cwd = path.resolve(options.cwd ?? process.cwd());

  const gitRoot = findGitRoot(path.dirname(config.filePath));
  if (gitRoot !== null && env.ALLOW_IN_REPO_PRODUCTION_DB !== "1") {
    throw new Error(
      `[DB SAFETY] Refusing to start production using SQLite database inside Git repository (${gitRoot}): ${config.filePath}. ` +
        `Store production data in a persistent directory outside Git (e.g. ${DEFAULT_PRODUCTION_DATA_DIR}/${DEFAULT_PRODUCTION_DB_FILENAME}) ` +
        `via DATABASE_PATH or KAPSAPP_DATA_DIR.`
    );
  }

  const targetSize = getExistingNonEmptySize(config.filePath);
  const legacyPath = path.resolve(cwd, DEFAULT_DEV_DB_FILENAME);
  const legacySize = legacyPath !== config.filePath ? getExistingNonEmptySize(legacyPath) : 0;

  if (targetSize === 0 && legacySize > 0 && env.ALLOW_EMPTY_PRODUCTION_DB !== "1") {
    throw new Error(
      `[DB SAFETY] Refusing to initialize an empty production database at ${config.filePath} because an unmigrated legacy database exists at ${legacyPath} (${legacySize} bytes). ` +
        `Stop all writers and run: node scripts/migrate-sqlite-db.mjs --source "${legacyPath}" --target "${config.filePath}"`
    );
  }
}

/**
 * Ensures the parent directory for a local SQLite database exists without
 * modifying or creating the database file itself.
 */
export function ensureDatabaseDirectory(config: ResolvedDatabaseConfig): void {
  if (config.kind !== "local-file" || !config.filePath) return;
  const dir = path.dirname(config.filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  }
}

export function createAppDatabaseClient(options: ResolveDatabaseOptions = {}): {
  client: Client;
  config: ResolvedDatabaseConfig;
} {
  const config = resolveDatabaseConfig(options);
  assertSafeDatabaseConfig(config, options);
  ensureDatabaseDirectory(config);

  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });

  return { client, config };
}

/**
 * Applies SQLite WAL durability/concurrency PRAGMAs and runs a fast integrity
 * check on local file databases so corruption is caught immediately instead of
 * silently serving broken data or overwriting the database.
 */
export async function configureSqliteRuntime(
  client: Client,
  config: ResolvedDatabaseConfig
): Promise<void> {
  if (config.kind === "remote") {
    return;
  }

  try {
    await client.execute("PRAGMA busy_timeout = 5000;");
    await client.execute("PRAGMA cache_size = -32000;");
    await client.execute("PRAGMA synchronous = NORMAL;");
    if (config.kind === "local-file") {
      await client.execute("PRAGMA journal_mode = WAL;");
    }
  } catch (err) {
    console.warn("[DB] Non-fatal PRAGMA notice:", err);
  }

  if (config.kind === "local-file") {
    const check = await client.execute("PRAGMA quick_check;");
    const results = check.rows.map((row) => String(Object.values(row)[0] ?? "").toLowerCase());
    if (results.length !== 1 || results[0] !== "ok") {
      throw new Error(
        `[DB INTEGRITY ERROR] SQLite quick_check failed for ${config.filePath}: ${results.join("; ")}. ` +
          `Server startup aborted to protect data. Inspect and recover from a verified backup manually; do not auto-overwrite.`
      );
    }
  }
}

/**
 * Gracefully checkpoints WAL (passive, non-blocking) and closes the LibSQL
 * client during SIGINT/SIGTERM shutdown.
 */
export async function closeDatabaseGracefully(
  client: Client,
  config: ResolvedDatabaseConfig
): Promise<void> {
  try {
    if (config.kind === "local-file") {
      await client.execute("PRAGMA wal_checkpoint(PASSIVE);").catch(() => {});
    }
  } finally {
    try {
      client.close();
    } catch {
      // Ignore already-closed client
    }
  }
}

export function formatDatabaseTargetForLog(config: ResolvedDatabaseConfig): string {
  if (config.kind === "local-file") {
    return `local SQLite (${config.filePath}) [source=${config.source}]`;
  }
  if (config.kind === "memory") {
    return `in-memory SQLite (${config.url}) [source=${config.source}]`;
  }
  try {
    const parsed = new URL(config.url);
    return `remote LibSQL (${parsed.protocol}//${parsed.host}) [source=${config.source}]`;
  } catch {
    return `remote LibSQL [source=${config.source}]`;
  }
}
