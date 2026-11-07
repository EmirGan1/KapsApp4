import { createClient } from "@libsql/client";
import { File } from "node:buffer";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { readIaArchive } from "../src/utils/readIaArchive";
import { readIaScoreName } from "../src/utils/subjectResources";

const [archivePath, flag] = process.argv.slice(2);
if (!archivePath || (flag !== undefined && flag !== "--apply")) {
  throw new Error("Usage: node --import tsx scripts/import-physics-ia.ts archive.zip [--apply]");
}

const archive = await readFile(archivePath);
const seen = new Set<string>();
const documents = (await readIaArchive(new File([archive], "physics.zip") as unknown as globalThis.File)).map(doc => {
  const score = doc.folders.map(readIaScoreName).filter(Boolean).at(-1);
  const key = JSON.stringify([...doc.folders, doc.name]);
  if (!score || !doc.folders.length || seen.has(key)) throw new Error(`Invalid or duplicate entry: ${key}`);
  seen.add(key);
  return { ...doc, score };
});
console.log(`${documents.length} PDFs, ${new Set(documents.map(doc => doc.folders[0])).size} root folders.`);
if (flag !== "--apply") process.exit(0);

const storage = path.resolve(process.env.SUBJECT_RESOURCES_DIR || "subject-resources-data");
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN,
});
const staged: string[] = [];
let committed = false;
let commitAttempted = false;
try {
  const users = await db.execute("SELECT id, username FROM users WHERE lower(username) = 'emirgan'");
  if (users.rows.length !== 1) throw new Error("Expected one Emirgan account.");
  const owner = users.rows[0];
  const columns = await db.execute("PRAGMA table_info(subject_resource_entries)");
  if (!["ia_points", "ia_maximum"].every(name => columns.rows.some(row => row.name === name))) {
    throw new Error("Physics IA scoring schema is missing. Deploy the scoring changes and open the archive once.");
  }

  await mkdir(storage, { recursive: true });
  const files = await Promise.allSettled(documents.map(async doc => {
    const storageKey = randomUUID();
    const destination = path.join(storage, storageKey);
    staged.push(destination);
    await writeFile(destination, doc.bytes, { flag: "wx", mode: 0o600 });
    return { ...doc, storageKey };
  }));
  const prepared = files.map(file => {
    if (file.status === "rejected") throw file.reason;
    return file.value;
  });

  const tx = await db.transaction("write");
  try {
    const removed = await tx.execute("DELETE FROM subject_resource_entries WHERE subject = 'Physics' AND collection = 'ia'");
    const ids = new Map<string, number>();
    for (const doc of prepared) {
      let parent: number | null = null;
      for (let depth = 0; depth < doc.folders.length; depth++) {
        const name = doc.folders[depth];
        const key = JSON.stringify(doc.folders.slice(0, depth + 1));
        let id = ids.get(key);
        if (id === undefined) {
          const score = doc.folders.slice(0, depth + 1).map(readIaScoreName).filter(Boolean).at(-1);
          const result = await tx.execute({
            sql: `INSERT INTO subject_resource_entries
                  (subject, collection, parent_id, name, owner_id, uploader, ia_points, ia_maximum)
                  VALUES ('Physics', 'ia', ?, ?, ?, ?, ?, ?)`,
            args: [parent, name, owner.id, owner.username, score?.points ?? null, score?.maximum ?? null],
          });
          id = Number(result.lastInsertRowid);
          ids.set(key, id);
        }
        parent = id;
      }
      await tx.execute({
        sql: `INSERT INTO subject_resource_entries
              (subject, collection, parent_id, name, owner_id, uploader, ia_points, ia_maximum, storage_key, mime_type, size)
              VALUES ('Physics', 'ia', ?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?)`,
        args: [parent, doc.name, owner.id, owner.username, doc.score.points, doc.score.maximum, doc.storageKey, doc.bytes.byteLength],
      });
    }
    commitAttempted = true;
    await tx.commit();
    committed = true;
    console.log(`Replaced ${removed.rowsAffected} records with ${ids.size} folders and ${prepared.length} PDFs. Previous disk files retained.`);
  } finally {
    if (!tx.closed) await tx.rollback();
  }
} finally {
  if (!committed && !commitAttempted) await Promise.allSettled(staged.map(file => unlink(file)));
  db.close();
}
