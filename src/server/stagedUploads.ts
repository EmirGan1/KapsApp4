import express, { type Express, type Request, type RequestHandler, type Response } from "express";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { UPLOAD_CHUNK_BYTES, UPLOAD_FILE_BYTES } from "../utils/uploadLimits";

type Session = {
  owner: string;
  size: number;
  received: number;
  filename: string;
  mimetype: string;
  expires: number;
  busy: boolean;
};

const ttl = 20 * 60 * 1000;

export function registerStagedUploads(app: Express, uploadsDir: string, authenticate: (req: Request) => Promise<{ id: unknown } | null>) {
  const stagingDir = path.join(path.dirname(uploadsDir), ".upload-staging");
  const sessions = new Map<string, Session>();
  const location = (id: string) => path.join(stagingDir, id);
  const remove = async (id: string) => {
    await fs.rm(location(id), { force: true });
    sessions.delete(id);
  };
  const cleanup = setInterval(() => {
    for (const [id, session] of sessions) {
      if (session.busy || session.expires > Date.now()) continue;
      session.busy = true;
      void remove(id).catch(() => { session.busy = false; });
    }
  }, 60_000);
  cleanup.unref();

  // Clear abandoned staging files left by a server restart after their session lifetime.
  void fs.mkdir(stagingDir, { recursive: true, mode: 0o700 }).then(async () => {
    for (const id of await fs.readdir(stagingDir)) {
      if (!/^[a-f0-9-]{36}$/.test(id) || sessions.has(id)) continue;
      const stat = await fs.stat(location(id)).catch(() => null);
      if (stat && stat.mtimeMs < Date.now() - ttl) await fs.rm(location(id), { force: true });
    }
  }).catch(error => console.error("Staged upload cleanup failed:", error));

  const authorize: RequestHandler = async (req, res, next) => {
    const user = await authenticate(req);
    if (!user) return void res.status(401).json({ error: "Oturum gerekli." });
    res.locals.stagedUploadOwner = String(user.id);
    next();
  };
  const find = (id: unknown, owner: string) => {
    const session = typeof id === "string" ? sessions.get(id) : undefined;
    return session?.owner === owner && session.expires > Date.now() ? session : undefined;
  };

  app.post("/api/upload/staged", authorize, async (req, res) => {
    const { size, filename, mimetype } = req.body ?? {};
    if (!Number.isSafeInteger(size) || size <= 0 || typeof filename !== "string" || !filename.trim() ||
        Buffer.byteLength(filename) > 255 || /[\x00-\x1f\x7f]/.test(filename) ||
        typeof mimetype !== "string" || mimetype.length > 127 || !/^[\w.+-]+\/[\w.+-]+$/.test(mimetype)) {
      return res.status(400).json({ error: "Geçersiz dosya bilgisi." });
    }
    if (size > UPLOAD_FILE_BYTES) return res.status(413).json({ error: "Bir dosya en fazla 300 MB olabilir." });
    const owner = res.locals.stagedUploadOwner;
    if (sessions.size >= 8 || [...sessions.values()].some(session => session.owner === owner)) {
      return res.status(429).json({ error: "Devam eden yükleme tamamlandıktan sonra tekrar dene." });
    }
    const id = randomUUID();
    const session = { owner, size, received: 0, filename: path.posix.basename(filename.replaceAll("\\", "/")), mimetype, expires: Date.now() + ttl, busy: true };
    sessions.set(id, session);
    try {
      await fs.mkdir(stagingDir, { recursive: true, mode: 0o700 });
      await fs.writeFile(location(id), "", { flag: "wx", mode: 0o600 });
      session.busy = false;
      return res.status(201).json({ id });
    } catch {
      sessions.delete(id);
      return res.status(500).json({ error: "Yükleme alanı hazırlanamadı." });
    }
  });

  app.put("/api/upload/staged/:id", authorize, express.raw({ type: "application/octet-stream", limit: UPLOAD_CHUNK_BYTES, inflate: false }), async (req, res) => {
    const id = String(req.params.id);
    const session = find(id, res.locals.stagedUploadOwner);
    if (!session) return res.status(404).json({ error: "Yükleme oturumu bulunamadı." });
    if (session.busy || String(session.received) !== req.query.offset) {
      return res.status(409).json({ error: "Yükleme parçası sıra dışında." });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length !== Math.min(UPLOAD_CHUNK_BYTES, session.size - session.received) || !req.body.length) {
      return res.status(400).json({ error: "Geçersiz yükleme parçası." });
    }
    session.busy = true;
    try {
      await fs.appendFile(location(id), req.body);
      session.received += req.body.length;
      session.expires = Date.now() + ttl;
      return res.status(204).end();
    } catch {
      session.expires = 0;
      return res.status(500).json({ error: "Dosya parçası kaydedilemedi." });
    } finally {
      session.busy = false;
    }
  });

  app.delete("/api/upload/staged/:id", authorize, async (req, res) => {
    const id = String(req.params.id);
    const session = find(id, res.locals.stagedUploadOwner);
    if (!session) return res.status(204).end();
    if (session.busy) return res.status(409).end();
    session.busy = true;
    try {
      await remove(id);
      return res.status(204).end();
    } catch {
      session.busy = false;
      return res.status(500).end();
    }
  });

  return async (req: Request, res: Response, owner: unknown, multipart: RequestHandler, next: (error?: any) => void) => {
    if (!req.is("application/json")) return void multipart(req, res, next);
    const id = req.body?.stagedUploadId;
    const session = find(id, String(owner));
    if (!session || session.busy || session.received !== session.size) {
      return void res.status(409).json({ error: "Dosya yüklemesi eksik veya oturumun süresi dolmuş." });
    }
    const fields = req.body.fields ?? {};
    if (typeof fields !== "object" || Array.isArray(fields) ||
        Object.entries(fields).some(([key, value]) => !/^[\w[\]-]{1,40}$/.test(key) || typeof value !== "string" || value.length > 8192)) {
      return void res.status(400).json({ error: "Geçersiz yükleme alanları." });
    }
    session.busy = true;
    const extension = path.extname(session.filename).toLowerCase();
    const filename = randomUUID() + (/^\.[a-z0-9]{1,12}$/.test(extension) ? extension : ".bin");
    const destination = path.join(uploadsDir, filename);
    try {
      await fs.rename(location(id), destination);
    } catch {
      session.busy = false;
      return void res.status(500).json({ error: "Dosya kaydedilemedi." });
    }
    sessions.delete(id);
    req.file = {
      fieldname: "file", filename, originalname: session.filename, mimetype: session.mimetype,
      size: session.size, path: destination, destination: uploadsDir, encoding: "7bit",
    } as Express.Multer.File;
    req.body = Object.assign(Object.create(null), fields);
    next();
  };
}
