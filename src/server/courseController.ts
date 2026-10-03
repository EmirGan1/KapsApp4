import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Course and Subject Files Controller
 * Handles uploading, querying, and deleting course materials and files
 * with role-based authorization (Uploader / Admin / Emirgan).
 */

export async function deleteCourseFileRecord(
  client: any,
  fileIdOrName: string | number,
  userId: number,
  isAdmin: boolean,
  deletePhysicalFileFn?: (path: string) => Promise<void>
): Promise<{ success: boolean; error?: string; status?: number; id?: number; folder_id?: string }> {
  const numId = Number(fileIdOrName);
  const isNum = !isNaN(numId);

  const fileRes = await client.execute({
    sql: "SELECT * FROM subject_files WHERE id = ? OR filename = ?",
    args: [isNum ? numId : fileIdOrName, String(fileIdOrName)]
  });

  if (fileRes.rows.length === 0) {
    return { success: false, error: "Dosya bulunamadı.", status: 404 };
  }

  const fileObj = fileRes.rows[0];
  const ownerId = Number(fileObj.uploaded_by);

  if (ownerId && ownerId !== Number(userId) && !isAdmin) {
    return { success: false, error: "Bu dosyayı silme yetkiniz bulunmamaktadır.", status: 403 };
  }

  // 1. Delete physical file from disk / database cache
  const filePath = (fileObj.url || fileObj.filename) as string;
  if (filePath && deletePhysicalFileFn) {
    await deletePhysicalFileFn(filePath).catch(() => {});
  }

  // 2. Delete database record
  await client.execute({ sql: "DELETE FROM subject_files WHERE id = ?", args: [fileObj.id] });
  await client.execute({ sql: "DELETE FROM uploaded_files WHERE filename = ?", args: [fileObj.filename] }).catch(() => {});

  return { success: true, id: Number(fileObj.id), folder_id: fileObj.folder_id || fileObj.course_id };
}

export function registerCourseRoutes(
  app: Express,
  client: any,
  upload: any,
  io: any,
  deleteUploadedFile: (filePath: string) => Promise<void>
) {
  // GET: List files for course / subject
  app.get(["/api/courses/:courseId/files", "/api/subjects/:courseId/files"], async (req: Request, res: Response) => {
    try {
      const folderId = req.params.courseId;
      const fileRes = await client.execute({
        sql: `SELECT f.*, u.username as uploader_name, u.avatar as uploader_avatar 
              FROM subject_files f 
              LEFT JOIN users u ON f.uploaded_by = u.id 
              WHERE f.folder_id = ? OR f.course_id = ? 
              ORDER BY f.id DESC`,
        args: [folderId, folderId]
      });
      res.json({ files: fileRes.rows });
    } catch (err: any) {
      res.status(500).json({ error: "Ders dosyaları alınırken hata oluştu." });
    }
  });

  // POST: Upload file for course
  app.post(["/api/courses/:courseId/files", "/api/subjects/:courseId/files"], (req: Request, res: Response) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FIELD_VALUE") {
          return res.status(413).json({ error: "Dosya boyutu çok büyük (Maksimum 300MB)." });
        }
        return res.status(400).json({ error: err.message || "Dosya yüklenemedi." });
      }
      try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) return res.status(401).json({ error: "Giriş yapmalısınız." });
        const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE token = ?", args: [token] });
        if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum." });
        const authUser = userRes.rows[0];

        if (!req.file) return res.status(400).json({ error: "Dosya seçilmedi." });
        const folderId = req.params.courseId;
        const filename = req.file.filename;
        const originalName = req.file.originalname;
        const mimetype = req.file.mimetype;
        const size = req.file.size;
        const filePath = req.file.path;
        const url = `/uploads/${filename}`;

        try {
          if (size <= 25 * 1024 * 1024 && fs.existsSync(filePath)) {
            const base64 = fs.readFileSync(filePath).toString("base64");
            await client.execute({
              sql: "INSERT OR REPLACE INTO uploaded_files (filename, original_name, mimetype, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
              args: [filename, originalName, mimetype, size, base64, new Date().toISOString()]
            });
          }
        } catch (err) {}

        const topicTag = req.body.topic_tag || req.body.topic || req.body.ib_theme || null;

        const insRes = await client.execute({
          sql: `INSERT INTO subject_files (folder_id, course_id, filename, original_name, mimetype, size, url, uploaded_by, topic_tag, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [folderId, folderId, filename, originalName, mimetype, size, url, authUser.id, topicTag, new Date().toISOString()]
        });

        const newFile = {
          id: Number(insRes.lastInsertRowid),
          folder_id: folderId,
          filename,
          original_name: originalName,
          mimetype,
          size,
          url,
          uploaded_by: authUser.id,
          uploader_name: authUser.username,
          topic_tag: topicTag,
          created_at: new Date().toISOString()
        };

        io.emit("subjects_updated");
        io.emit("folder_files_updated", { folderId });
        res.json({ success: true, file: newFile });
      } catch (err: any) {
        console.error("Course file upload error:", err);
        res.status(500).json({ error: "Ders dosyası yüklenemedi." });
      }
    });
  });

  // DELETE: Delete course file
  app.delete(["/api/courses/files/:fileId", "/api/subjects/files/:fileId"], async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Giriş yapmalısınız." });
      const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum." });
      const authUser = userRes.rows[0];

      const rawId = req.params.fileId;
      const usernameStr = authUser.username ? String(authUser.username).trim().toLowerCase() : "";
      const isEmirgan = usernameStr === "emirgan" || authUser.is_admin === 1 || (authUser as any).role === "admin";

      const result = await deleteCourseFileRecord(client, rawId, Number(authUser.id), isEmirgan, deleteUploadedFile);

      if (!result.success) {
        return res.status(result.status || 400).json({ error: result.error });
      }

      io.emit("subjects_updated");
      if (result.folder_id) {
        io.emit("folder_files_updated", { folderId: result.folder_id });
      }
      io.emit("file:deleted", { id: result.id });
      res.json({ success: true, id: result.id });
    } catch (err: any) {
      console.error("Course file delete error:", err);
      res.status(500).json({ error: "Ders dosyası silinirken hata oluştu." });
    }
  });
}
