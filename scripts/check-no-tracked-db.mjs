#!/usr/bin/env node
/**
 * Automated safeguard preventing runtime SQLite database, WAL, SHM, and
 * journal files from ever being staged or tracked in Git.
 *
 * Usage:
 *   node scripts/check-no-tracked-db.mjs              # Checks both tracked & staged files
 *   node scripts/check-no-tracked-db.mjs --staged     # Pre-commit mode (staged files only)
 *   node scripts/check-no-tracked-db.mjs --strict-git # Fail if not inside a Git repo (CI mode)
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_PATTERNS = [
  /\.db$/i,
  /\.db-(wal|shm|journal)$/i,
  /\.sqlite3?$/i,
  /\.sqlite3?-(wal|shm|journal)$/i,
  /(?:^|\/)local\.db(?:$|[-.])/i,
  /(?:^|\/)kapsapp\.db(?:$|[-.])/i,
  /-(wal|shm|journal)$/i,
];

export function isForbiddenSqliteFile(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/").trim();
  if (!normalized) return false;
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function findForbiddenDbFiles(filePaths) {
  const matches = [];
  for (const filePath of filePaths) {
    if (isForbiddenSqliteFile(filePath)) {
      matches.push(filePath);
    }
  }
  return Array.from(new Set(matches)).sort();
}

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function splitNullSeparated(raw) {
  return raw
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function checkGitRepositoryForSqliteFiles({
  cwd = process.cwd(),
  stagedOnly = false,
  strictGit = false,
} = {}) {
  try {
    runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  } catch {
    if (strictGit) {
      return {
        ok: false,
        inGitRepo: false,
        violations: [],
        error: "Not inside a Git working tree (--strict-git enabled).",
      };
    }
    return {
      ok: true,
      inGitRepo: false,
      violations: [],
      warning: "Not inside a Git repository; skipped git index inspection.",
    };
  }

  const candidateFiles = [];
  if (!stagedOnly) {
    const tracked = runGit(["ls-files", "-z"], cwd);
    candidateFiles.push(...splitNullSeparated(tracked));
  }
  const staged = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], cwd);
  candidateFiles.push(...splitNullSeparated(staged));

  const violations = findForbiddenDbFiles(candidateFiles);
  return {
    ok: violations.length === 0,
    inGitRepo: true,
    violations,
  };
}

const isCliEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntry) {
  const args = new Set(process.argv.slice(2));
  const stagedOnly = args.has("--staged");
  const strictGit = args.has("--strict-git");
  const result = checkGitRepositoryForSqliteFiles({ stagedOnly, strictGit });

  if (!result.inGitRepo) {
    if (!result.ok) {
      console.error(`[DB GUARD ERROR] ${result.error}`);
      process.exit(1);
    }
    console.warn(`[DB GUARD NOTICE] ${result.warning}`);
    process.exit(0);
  }

  if (!result.ok) {
    console.error("\n[DB GUARD BLOCKED] Runtime SQLite database files MUST NOT be committed or tracked in Git:");
    for (const file of result.violations) {
      console.error(`  - ${file}`);
    }
    console.error("\nHow to fix without deleting your local file:");
    console.error(`  git rm --cached ${result.violations.map((f) => `"${f}"`).join(" ")}`);
    console.error("  git status\n");
    process.exit(1);
  }

  console.log(
    `[DB GUARD OK] No tracked${stagedOnly ? " (staged)" : ""} SQLite runtime database files found.`
  );
}
