import express from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import type { Client, Row } from "@libsql/client";
import type { Request, RequestHandler, Express } from "express";

import { emptyUniversityData, CV_FIELDS } from "../shared/university";
const API = "/api/university-vault";
export const UNI_CATEGORIES = [
  "cv",
  "certificates",
  "activities",
  "education",
  "languages",
  "letters",
  "applications",
  "identity",
  "other",
];
const idValid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9-]{36}$/.test(v);
const clean = (v: unknown, limit: number) =>
  typeof v === "string" && v.length <= limit && !v.includes("\0");
const dateValid = (v: unknown) =>
  v === "" ||
  (typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v);
const linkValid = (v: string) => {
  try {
    const u = new URL(v);
    return (
      ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return !v;
  }
};
function parse(value: any) {
  if (!value || typeof value !== "object") return null;
  const defaults = emptyUniversityData();
  const data = Object.fromEntries(
    Object.keys(defaults).map((k) => [
      k,
      value[k] ?? defaults[k as keyof typeof defaults],
    ]),
  ) as typeof defaults;
  if (
    !data.cv ||
    typeof data.cv !== "object" ||
    Object.keys(CV_FIELDS).some((key) => !clean(data.cv[key], 6000))
  )
    return null;
  data.cv = Object.fromEntries(
    Object.keys(CV_FIELDS).map((key) => [key, data.cv[key]]),
  ) as typeof data.cv;
  if (
    !clean(data.title, 160) ||
    !data.title.trim() ||
    !UNI_CATEGORIES.includes(data.category) ||
    !clean(data.institution, 200) ||
    !clean(data.text, 40000) ||
    !clean(data.tags, 500) ||
    !clean(data.language, 80) ||
    !clean(data.program, 200) ||
    !clean(data.country, 100) ||
    !clean(data.url, 2048) ||
    !linkValid(data.url) ||
    !dateValid(data.date) ||
    !dateValid(data.deadline) ||
    ![
      "draft",
      "preparing",
      "ready",
      "submitted",
      "accepted",
      "rejected",
    ].includes(data.status) ||
    !Array.isArray(data.requirementIds) ||
    data.requirementIds.length > 200 ||
    data.requirementIds.some((v) => !idValid(v))
  )
    return null;
  return data;
}
const item = (r: Row) => ({
  id: String(r.id),
  parentId: r.parent_id ? String(r.parent_id) : null,
  kind: String(r.kind),
  data: JSON.parse(String(r.data)),
  version: Number(r.version),
  updatedAt: String(r.updated_at),
  file: r.file_name
    ? {
        name: String(r.file_name),
        size: Number(r.file_size),
        hash: String(r.file_hash),
      }
    : null,
});
export function registerUniversity(
  app: Express,
  db: Client,
  authenticate: (req: Request) => Promise<{ id: unknown } | null>,
  device: RequestHandler,
) {
  let initialized: Promise<unknown> | undefined;
  const initialize = () =>
    (initialized ??= db
      .batch(
        [
          "CREATE TABLE IF NOT EXISTS private_uni_owner(singleton INTEGER PRIMARY KEY CHECK(singleton=1),user_id INTEGER NOT NULL)",
          "CREATE TABLE IF NOT EXISTS private_uni_items(id TEXT PRIMARY KEY,parent_id TEXT,kind TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,file_name TEXT,file_size INTEGER,file_hash TEXT,file_data BLOB)",
          "CREATE INDEX IF NOT EXISTS private_uni_parent ON private_uni_items(parent_id)",
        ],
        "write",
      )
      .catch((e) => {
        initialized = undefined;
        throw e;
      }));
  const limits = new Map<number, { at: number; count: number }>();
  const router = express.Router();
  app.use(
    API,
    device,
    async (req, res, next) => {
      res.set({
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      });
      try {
        if (!/^Bearer \S{1,512}$/i.test(req.headers.authorization ?? ""))
          return void res.sendStatus(401);
        const user = await authenticate(req);
        if (!user) return void res.sendStatus(401);
        let owner = Number(process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID);
        if (!owner) {
          const tables = await db.execute(
            "SELECT name FROM sqlite_master WHERE name='private_travel_members'",
          );
          if (tables.rows.length) {
            const pinned = await db.execute(
              "SELECT user_id FROM private_travel_members WHERE role='Emirgan'",
            );
            owner = Number(pinned.rows[0]?.user_id);
          }
        }
        if (
          !Number.isSafeInteger(owner) ||
          owner <= 0 ||
          Number(user.id) !== owner
        )
          return void res.sendStatus(403);
        await initialize();
        await db.execute({
          sql: "INSERT OR IGNORE INTO private_uni_owner VALUES(1,?)",
          args: [owner],
        });
        const pinned = await db.execute(
          "SELECT user_id FROM private_uni_owner WHERE singleton=1",
        );
        if (Number(pinned.rows[0]?.user_id) !== owner)
          return void res.sendStatus(403);
        if (req.method !== "GET") {
          const now = Date.now(),
            old = limits.get(owner);
          const rate =
            !old || now - old.at > 60000
              ? { at: now, count: 1 }
              : { ...old, count: old.count + 1 };
          limits.set(owner, rate);
          if (rate.count > 60)
            return void res
              .status(429)
              .json({ error: "İşlem sınırına ulaşıldı. Bir dakika bekle." });
        }
        next();
      } catch {
        res.status(503).json({
          error:
            "Başvuru arşivi açılamıyor. Kimlik ve veritabanı ayarlarını kontrol edin.",
        });
      }
    },
    router,
  );
  router.use(express.json({ limit: "256kb", inflate: false }));
  const wrap =
    (
      fn: (req: Request, res: express.Response) => Promise<unknown>,
    ): RequestHandler =>
    (req, res) => {
      void fn(req, res).catch(() => {
        if (!res.headersSent)
          res.status(503).json({
            error: "İşlem kaydedilemedi. Taslağını koruyup tekrar dene.",
          });
      });
    };
  router.get("/access", (_req, res) => res.json({ allowed: true }));
  router.get(
    "/items",
    wrap(async (_req, res) => {
      const result = await db.execute(
        "SELECT id,parent_id,kind,data,version,updated_at,file_name,file_size,file_hash FROM private_uni_items ORDER BY updated_at DESC",
      );
      res.json({ items: result.rows.map(item) });
    }),
  );
  router.post(
    "/items",
    wrap(async (req, res) => {
      const { id, parentId = null, kind, data: raw, version } = req.body ?? {};
      const data = parse(raw);
      if (
        !idValid(id) ||
        !data ||
        !["folder", "record"].includes(kind) ||
        (parentId !== null && !idValid(parentId))
      )
        return res.sendStatus(400);
      const tx = await db.transaction("write");
      try {
        const result = await tx.execute({
          sql: "SELECT version,kind FROM private_uni_items WHERE id=?",
          args: [id],
        });
        const old = result.rows[0];
        if (old && Number(old.version) !== version)
          return res.status(409).json({
            error:
              "Bu kayıt başka bir sekmede değişti. Taslağın korundu. Güncel kaydı açıp birleştir.",
          });
        if (!old && version !== undefined) return res.sendStatus(404);
        if (old && String(old.kind) !== kind) return res.sendStatus(400);
        if (parentId) {
          const parent = await tx.execute({
            sql: "SELECT kind FROM private_uni_items WHERE id=?",
            args: [parentId],
          });
          if (parent.rows[0]?.kind !== "folder" || parentId === id)
            return res
              .status(400)
              .json({ error: "Geçerli bir üst klasör seç." });
          const ancestors = await tx.execute({
            sql: "WITH RECURSIVE ancestors(id,parent_id) AS (SELECT id,parent_id FROM private_uni_items WHERE id=? UNION SELECT i.id,i.parent_id FROM private_uni_items i JOIN ancestors a ON i.id=a.parent_id) SELECT id FROM ancestors",
            args: [parentId],
          });
          if (ancestors.rows.some((r) => r.id === id))
            return res
              .status(400)
              .json({ error: "Klasör kendi alt klasörüne taşınamaz." });
        }
        for (const linked of data.requirementIds) {
          if (linked === id) return res.sendStatus(400);
          const found = await tx.execute({
            sql: "SELECT id FROM private_uni_items WHERE id=? AND kind='record'",
            args: [linked],
          });
          if (!found.rows.length)
            return res
              .status(400)
              .json({ error: "Bağlanan belge bulunamadı." });
        }
        if (old)
          await tx.execute({
            sql: "UPDATE private_uni_items SET data=?,parent_id=?,version=version+1,updated_at=? WHERE id=?",
            args: [
              JSON.stringify(data),
              parentId,
              new Date().toISOString(),
              id,
            ],
          });
        else {
          const count = await tx.execute(
            "SELECT COUNT(*) AS n FROM private_uni_items",
          );
          if (Number(count.rows[0].n) >= 3000)
            return res
              .status(409)
              .json({ error: "Arşivde en fazla 3.000 kayıt saklanabilir." });
          await tx.execute({
            sql: "INSERT INTO private_uni_items(id,parent_id,kind,data,updated_at) VALUES(?,?,?,?,?)",
            args: [
              id,
              parentId,
              kind,
              JSON.stringify(data),
              new Date().toISOString(),
            ],
          });
        }
        await tx.commit();
        res.json({ ok: true, version: old ? Number(old.version) + 1 : 1 });
      } finally {
        tx.close();
      }
    }),
  );
  let uploading = false;
  const singleUpload: RequestHandler = (_req, res, next) => {
    if (uploading)
      return void res
        .status(429)
        .json({ error: "Başka bir dosya yükleniyor. Tamamlanmasını bekle." });
    uploading = true;
    res.once("finish", () => {
      uploading = false;
    });
    res.once("close", () => {
      uploading = false;
    });
    next();
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: 8 * 1024 * 1024, fields: 1, fieldSize: 20 },
  });
  router.post(
    "/items/:id/file",
    singleUpload,
    upload.single("file"),
    wrap(async (req, res) => {
      const version = Number(req.body?.version),
        file = req.file;
      if (!idValid(req.params.id) || !Number.isSafeInteger(version) || !file)
        return res.sendStatus(400);
      const ext = file.originalname.split(".").at(-1)?.toLowerCase();
      const b = file.buffer;
      const valid =
        (ext === "pdf" && b.subarray(0, 5).toString() === "%PDF-") ||
        (ext === "png" &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (["jpg", "jpeg"].includes(ext ?? "") &&
          b[0] === 255 &&
          b[1] === 216 &&
          b[2] === 255) ||
        (["docx", "xlsx", "odt"].includes(ext ?? "") &&
          b.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) ||
        (ext === "txt" && !b.includes(0));
      if (!valid)
        return res.status(400).json({
          error:
            "PDF, PNG, JPG, DOCX, XLSX, ODT veya TXT dosyası seç. Dosya içeriği uzantısıyla uyuşmalı.",
        });
      const tx = await db.transaction("write");
      try {
        const existing = await tx.execute({
          sql: "SELECT version,file_size FROM private_uni_items WHERE id=? AND kind='record'",
          args: [req.params.id],
        });
        if (!existing.rows.length) return res.sendStatus(404);
        if (Number(existing.rows[0].version) !== version)
          return res.status(409).json({
            error: "Kayıt değişmiş. Güncel kaydı açıp dosyayı tekrar seç.",
          });
        const total = await tx.execute(
          "SELECT COALESCE(SUM(file_size),0) AS bytes FROM private_uni_items",
        );
        if (
          Number(total.rows[0].bytes) -
            Number(existing.rows[0].file_size ?? 0) +
            file.size >
          512 * 1024 * 1024
        )
          return res
            .status(409)
            .json({ error: "Özel arşivin 512 MB depolama sınırına ulaşıldı." });
        const name = file.originalname
          .replace(/[\r\n\0/\\]/g, "_")
          .slice(0, 200);
        await tx.execute({
          sql: "UPDATE private_uni_items SET file_name=?,file_size=?,file_hash=?,file_data=?,version=version+1,updated_at=? WHERE id=?",
          args: [
            name,
            file.size,
            createHash("sha256").update(b).digest("hex"),
            b,
            new Date().toISOString(),
            req.params.id,
          ],
        });
        await tx.commit();
        res.json({ ok: true });
      } finally {
        tx.close();
      }
    }),
  );
  router.get(
    "/items/:id/file",
    wrap(async (req, res) => {
      if (!idValid(req.params.id)) return res.sendStatus(404);
      const result = await db.execute({
        sql: "SELECT file_name,file_data FROM private_uni_items WHERE id=?",
        args: [req.params.id],
      });
      const row = result.rows[0];
      if (!row?.file_data) return res.sendStatus(404);
      res.set({
        "Content-Type": "application/octet-stream",
        "Content-Security-Policy": "sandbox",
        "Content-Disposition":
          "attachment; filename*=UTF-8''" +
          encodeURIComponent(String(row.file_name)),
      });
      res.send(Buffer.from(row.file_data as ArrayBuffer));
    }),
  );
  router.post(
    "/items/:id/delete",
    wrap(async (req, res) => {
      if (!idValid(req.params.id) || !Number.isSafeInteger(req.body?.version))
        return res.sendStatus(400);
      const tx = await db.transaction("write");
      try {
        const row = await tx.execute({
          sql: "SELECT version FROM private_uni_items WHERE id=?",
          args: [req.params.id],
        });
        if (!row.rows.length) return res.sendStatus(404);
        if (Number(row.rows[0].version) !== req.body.version)
          return res
            .status(409)
            .json({ error: "Kayıt değişti. Yenileyip tekrar dene." });
        const children = await tx.execute({
          sql: "SELECT id FROM private_uni_items WHERE parent_id=? LIMIT 1",
          args: [req.params.id],
        });
        if (children.rows.length)
          return res
            .status(409)
            .json({ error: "Klasör boş değil. İçeriği taşı veya sil." });
        const references = await tx.execute({
          sql: "SELECT id,data FROM private_uni_items WHERE kind='record' AND id!=?",
          args: [req.params.id],
        });
        if (
          references.rows.some((r) =>
            parse(JSON.parse(String(r.data)))?.requirementIds.includes(
              req.params.id,
            ),
          )
        )
          return res.status(409).json({
            error:
              "Bu belge bir başvuruya bağlı. Önce başvurudaki bağlantıyı kaldır.",
          });
        await tx.execute({
          sql: "DELETE FROM private_uni_items WHERE id=?",
          args: [req.params.id],
        });
        await tx.commit();
        res.json({ ok: true });
      } finally {
        tx.close();
      }
    }),
  );
  router.use((_req, res) => res.sendStatus(404));
  router.use(((error, _req, res, _next) =>
    res
      .status(
        error.code === "LIMIT_FILE_SIZE" || error.status === 413 ? 413 : 400,
      )
      .json({
        error: "Dosya en fazla 8 MB olabilir; isteği ve dosyayı kontrol et.",
      })) as express.ErrorRequestHandler);
}
