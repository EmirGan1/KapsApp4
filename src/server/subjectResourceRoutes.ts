import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { getAuthUserFromRequest, isEmirganOrRootAdmin } from "./courseController";
import { RESOURCE_FILE_LIMIT_MB, RESOURCE_PREVIEW_TYPES, SUBJECTS } from "../utils/subjectResources";

const route = "/api/courses/:subject/resources/:collection";
const storage = path.resolve(process.env.SUBJECT_RESOURCES_DIR || "subject-resources-data");

function parseId(value: unknown) {
  const id = Number(value);
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(id) ? id : null;
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= 240 && !/[\\/\x00-\x1f\x7f]/.test(name) && name !== "." && name !== ".." ? name : null;
}

export function registerSubjectResourceRoutes(app: Express, db: any) {
  let schema: Promise<void> | undefined;
  function ready() {
    return schema ??= (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS subject_resource_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL, collection TEXT NOT NULL,
        parent_id INTEGER REFERENCES subject_resource_entries(id),
        name TEXT NOT NULL, storage_key TEXT, mime_type TEXT, size INTEGER,
        owner_id INTEGER NOT NULL, uploader TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_subject_resource_scope
        ON subject_resource_entries(subject, collection, parent_id)`);
    })().catch(error => { schema = undefined; throw error; });
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        mkdir(storage, { recursive: true }).then(() => callback(null, storage), error => callback(error, storage));
      },
      filename: (_req, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: RESOURCE_FILE_LIMIT_MB * 1024 * 1024, files: 1, fields: 0 },
  }).single("file");

  type Context = { subject: string; collection: string; user: { id: number; username: string }; admin: boolean };
  function handle(action: (req: Request, res: Response, ctx: Context) => Promise<unknown>) {
    return async (req: Request, res: Response) => {
      try {
        const subject = SUBJECTS.find(item => item.toLowerCase() === String(req.params.subject).toLowerCase());
        const collection = String(req.params.collection);
        if (!subject || !["ia", "ee"].includes(collection)) return res.status(404).json({ error: "Kaynak alanı bulunamadı." });
        const user = req.headers.authorization?.startsWith("Bearer ")
          ? await getAuthUserFromRequest(req, db) : null;
        if (!user) return res.status(401).json({ error: "Kaynaklara erişmek için giriş yapmalısınız." });
        res.set("Cache-Control", "private, no-store");
        await ready();
        await action(req, res, { subject, collection, user, admin: isEmirganOrRootAdmin(user) });
      } catch (error) {
        console.error("Subject resources:", error);
        if (!res.headersSent) res.status(500).json({ error: "Kaynak işlemi tamamlanamadı." });
      }
    };
  }

  async function find(ctx: Context, id: number | null) {
    if (id === null) return undefined;
    return (await db.execute({
      sql: "SELECT * FROM subject_resource_entries WHERE id = ? AND subject = ? AND collection = ?",
      args: [id, ctx.subject, ctx.collection],
    })).rows[0];
  }

  async function getParent(req: Request, ctx: Context) {
    if (req.query.parent === undefined) return null;
    const parent = await find(ctx, parseId(req.query.parent));
    return parent && parent.storage_key === null ? parent : undefined;
  }

  app.get(route, handle(async (req, res, ctx) => {
    const parent = await getParent(req, ctx);
    if (parent === undefined) return res.status(404).json({ error: "Klasör bulunamadı." });
    const breadcrumbs: { id: number; name: string }[] = [];
    for (let folder = parent; folder; folder = await find(ctx, folder.parent_id)) {
      breadcrumbs.unshift({ id: folder.id, name: folder.name });
    }
    const result = await db.execute({
      sql: `SELECT id, name, storage_key IS NULL AS is_folder, mime_type, size, owner_id, uploader, created_at
            FROM subject_resource_entries WHERE subject = ? AND collection = ? AND parent_id IS ?
            ORDER BY is_folder DESC, name COLLATE NOCASE, id`,
      args: [ctx.subject, ctx.collection, parent?.id ?? null],
    });
    res.json({
      breadcrumbs,
      entries: result.rows.map(({ owner_id, ...entry }: any) => ({
        ...entry, canRename: ctx.admin || Number(owner_id) === Number(ctx.user.id),
      })),
    });
  }));

  app.post(`${route}/folders`, handle(async (req, res, ctx) => {
    const parent = await getParent(req, ctx);
    if (parent === undefined) return res.status(404).json({ error: "Klasör bulunamadı." });
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: "Geçerli bir klasör adı girin (en fazla 240 karakter)." });
    await db.execute({
      sql: "INSERT INTO subject_resource_entries (subject, collection, parent_id, name, owner_id, uploader) VALUES (?, ?, ?, ?, ?, ?)",
      args: [ctx.subject, ctx.collection, parent?.id ?? null, name, ctx.user.id, ctx.user.username],
    });
    res.sendStatus(201);
  }));

  app.post(`${route}/files`, handle(async (req, res, ctx) => {
    const parent = await getParent(req, ctx);
    if (parent === undefined) return res.status(404).json({ error: "Klasör bulunamadı." });
    try {
      await new Promise<void>((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()));
    } catch (error) {
      const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "Dosya en fazla 50 MB olabilir." : "Dosya alınamadı." });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Dosya seçin." });
    let saved = false;
    try {
      const name = cleanName(Buffer.from(file.originalname, "latin1").toString("utf8"));
      if (!name) return res.status(400).json({ error: "Dosya adı geçersiz." });
      await db.execute({
        sql: `INSERT INTO subject_resource_entries
              (subject, collection, parent_id, name, storage_key, mime_type, size, owner_id, uploader)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [ctx.subject, ctx.collection, parent?.id ?? null, name, file.filename, file.mimetype, file.size, ctx.user.id, ctx.user.username],
      });
      saved = true;
      res.sendStatus(201);
    } finally {
      if (!saved) await unlink(file.path).catch(() => {});
    }
  }));

  app.patch(`${route}/:id`, handle(async (req, res, ctx) => {
    const entry = await find(ctx, parseId(req.params.id));
    if (!entry) return res.status(404).json({ error: "Kaynak bulunamadı." });
    if (!ctx.admin && Number(entry.owner_id) !== Number(ctx.user.id)) {
      return res.status(403).json({ error: "Bu kaynağı yeniden adlandırma yetkiniz yok." });
    }
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: "Geçerli bir ad girin (en fazla 240 karakter)." });
    await db.execute({ sql: "UPDATE subject_resource_entries SET name = ? WHERE id = ?", args: [name, entry.id] });
    res.sendStatus(204);
  }));

  app.get(`${route}/:id/file`, handle(async (req, res, ctx) => {
    const entry = await find(ctx, parseId(req.params.id));
    if (!entry?.storage_key) return res.status(404).json({ error: "Dosya bulunamadı." });
    const preview = req.query.preview === "1";
    if (preview && !RESOURCE_PREVIEW_TYPES.includes(entry.mime_type)) {
      return res.status(415).json({ error: "Bu dosya türü tarayıcıda önizlenemiyor." });
    }
    res.set("X-Content-Type-Options", "nosniff");
    res.attachment(entry.name);
    res.type(preview ? entry.mime_type : "application/octet-stream");
    res.sendFile(entry.storage_key, { root: storage, cacheControl: false }, error => {
      if (error && !res.headersSent) res.status(404).json({ error: "Dosya depoda bulunamadı." });
      else if (error) res.destroy(error);
    });
  }));
}
