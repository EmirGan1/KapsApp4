import fs from "node:fs";
import path from "node:path";

export const DEFAULT_PRODUCTION_DATA_DIR = "/var/lib/kapsapp";
export const DEFAULT_PRODUCTION_DB_FILENAME = "kapsapp.db";
export const DEFAULT_DEV_DB_FILENAME = "local.db";

const REMOTE_URL_PATTERN = /^(libsql|https?|wss?):\/\//i;

function readEnv(env, key) {
  const val = env[key];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

function isMemorySpecifier(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === ":memory:" ||
    normalized === "file::memory:" ||
    normalized.startsWith("file::memory:?")
  );
}

function parseFileSpecifier(specifier, cwd) {
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
      // Keep raw string
    }
  }
  const filePath = path.resolve(cwd, raw);
  return { filePath, url: `file:${filePath}${querySuffix}` };
}

export function findGitRoot(startDir) {
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

/**
 * Mirrors src/server/dbConfig.ts for plain Node.js operational scripts.
 */
export function resolveScriptDatabaseConfig({ env = process.env, cwd = process.cwd() } = {}) {
  const resolvedCwd = path.resolve(cwd);
  const isProduction = env.NODE_ENV === "production";
  const authToken = readEnv(env, "TURSO_AUTH_TOKEN") ?? readEnv(env, "LIBSQL_AUTH_TOKEN") ?? undefined;

  for (const key of ["TURSO_DATABASE_URL", "LIBSQL_URL"]) {
    const value = readEnv(env, key);
    if (!value) continue;
    if (isMemorySpecifier(value)) {
      return { kind: "memory", url: value, filePath: null, authToken, source: key, isProduction };
    }
    if (REMOTE_URL_PATTERN.test(value)) {
      return { kind: "remote", url: value, filePath: null, authToken, source: key, isProduction };
    }
    const parsed = parseFileSpecifier(value, resolvedCwd);
    return { kind: "local-file", ...parsed, authToken, source: key, isProduction };
  }

  for (const key of ["DATABASE_PATH", "KAPSAPP_DB_PATH", "SQLITE_DB_PATH"]) {
    const value = readEnv(env, key);
    if (!value) continue;
    if (isMemorySpecifier(value)) {
      return { kind: "memory", url: value, filePath: null, authToken, source: key, isProduction };
    }
    const parsed = parseFileSpecifier(value, resolvedCwd);
    return { kind: "local-file", ...parsed, authToken, source: key, isProduction };
  }

  for (const key of ["KAPSAPP_DATA_DIR", "DATA_DIR"]) {
    const value = readEnv(env, key);
    if (!value) continue;
    const filePath = path.join(path.resolve(resolvedCwd, value), DEFAULT_PRODUCTION_DB_FILENAME);
    return { kind: "local-file", filePath, url: `file:${filePath}`, authToken, source: key, isProduction };
  }

  if (isProduction) {
    const filePath = path.join(DEFAULT_PRODUCTION_DATA_DIR, DEFAULT_PRODUCTION_DB_FILENAME);
    return { kind: "local-file", filePath, url: `file:${filePath}`, authToken, source: "production-default", isProduction };
  }

  const filePath = path.resolve(resolvedCwd, DEFAULT_DEV_DB_FILENAME);
  return { kind: "local-file", filePath, url: `file:${filePath}`, authToken, source: "development-default", isProduction };
}
