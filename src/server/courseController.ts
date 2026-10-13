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

export function cleanParseTopics(topicsData: any, fallbackTag?: any): string[] {
  const sanitize = (val: any): string => {
    if (!val) return "";
    let s = String(val).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    return s.replace(/\\"/g, '"').trim();
  };

  const extract = (item: any): string[] => {
    if (!item) return [];
    if (Array.isArray(item)) return item.flatMap(extract);
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed.flatMap(extract) : extract(parsed);
        } catch {
          const stripped = trimmed.replace(/^[\[{\("']+|[\]}\)"']+$/g, "");
          if (stripped.includes(",")) return stripped.split(",").flatMap(extract);
          return [sanitize(stripped)];
        }
      }
      if (trimmed.includes(",")) {
        return trimmed.split(",").flatMap(extract);
      }
      return [sanitize(trimmed)];
    }
    return [sanitize(item)];
  };

  let list: string[] = [];
  if (topicsData) list = extract(topicsData);
  if (list.length === 0 && fallbackTag) list = extract(fallbackTag);

  const clean = list
    .map(sanitize)
    .filter((s) => s.length > 0 && s !== "null" && s !== "undefined" && s !== "[]");
  return Array.from(new Set(clean));
}

export function registerCourseRoutes(
  app: Express,
  client: any,
  upload: any,
  io: any,
  deleteUploadedFile: (filePath: string) => Promise<void>
) {
  // Ensure 'topics' and 'doc_type' columns exist in subject_files
  client.execute("ALTER TABLE subject_files ADD COLUMN topics TEXT").catch(() => {});
  client.execute("ALTER TABLE subject_files ADD COLUMN doc_type TEXT").catch(() => {});

  // GET: List files for course / subject (Supports multi-topic filter & ALL topic)
  app.get(["/api/courses/:courseId/files", "/api/subjects/:courseId/files"], async (req: Request, res: Response) => {
    try {
      const folderId = req.params.courseId;
      const requestedTopic = (req.query.topic || req.query.theme) as string | undefined;

      const fileRes = await client.execute({
        sql: `SELECT f.*, u.username as uploader_name, u.avatar as uploader_avatar 
              FROM subject_files f 
              LEFT JOIN users u ON f.uploaded_by = u.id 
              WHERE f.folder_id = ? OR f.course_id = ? 
              ORDER BY f.id DESC`,
        args: [folderId, folderId]
      });

      const parsedFiles = fileRes.rows.map((row: any) => {
        const topicsArray = cleanParseTopics(row.topics, row.topic_tag);
        const primaryTag = topicsArray.includes("ALL") ? "ALL" : (topicsArray[0] || (row.topic_tag ? String(row.topic_tag).replace(/^[\[{\("']+|[\]}\)"']+$/g, '') : null));

        // Detect or normalize docType
        let docType = row.doc_type;
        if (!docType) {
          const origLower = (row.original_name || row.filename || '').toLowerCase();
          if (origLower.includes('markscheme') || origLower.includes('_ms') || origLower.includes('mark scheme') || origLower.includes('cevap') || origLower.includes('cozum') || origLower.includes('çözüm')) {
            docType = 'mark_scheme';
          } else if (origLower.includes('paper') || origLower.includes('exam') || origLower.includes('soru') || origLower.includes('deneme') || origLower.includes('test')) {
            docType = 'question_paper';
          } else if (origLower.includes('note') || origLower.includes('not') || origLower.includes('ozet') || origLower.includes('özet') || origLower.includes('summary')) {
            docType = 'notes';
          } else {
            docType = 'other';
          }
        }

        return {
          ...row,
          topics: topicsArray,
          topic_tag: primaryTag,
          docType: docType,
          doc_type: docType
        };
      });

      // Filter by topic if requested
      let filteredFiles = parsedFiles;
      if (requestedTopic && requestedTopic !== "all") {
        filteredFiles = parsedFiles.filter((f: any) => {
          if (!f.topics || f.topics.length === 0) return true;
          // Matches if file is for ALL topics OR includes the requested topic
          const hasAll = f.topics.includes("ALL") || f.topics.includes("Hepsi") || f.topic_tag === "ALL";
          const hasTopic = f.topics.includes(requestedTopic) || f.topic_tag === requestedTopic;
          return hasAll || hasTopic;
        });
      }

      res.json({ files: filteredFiles });
    } catch (err: any) {
      console.error("GET /api/courses/:courseId/files error:", err);
      res.status(500).json({ error: "Ders dosyaları alınırken hata oluştu." });
    }
  });

  // POST: Upload file for course with multi-topic support
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

        // Multi-topic resolution
        const allTopics = req.body.allTopics === true || req.body.allTopics === "true";
        let topicsList: string[] = [];

        if (allTopics) {
          topicsList = ["ALL"];
        } else if (Array.isArray(req.body.topics)) {
          topicsList = req.body.topics;
        } else if (typeof req.body.topics === "string") {
          try {
            const parsed = JSON.parse(req.body.topics);
            if (Array.isArray(parsed)) topicsList = parsed;
            else topicsList = [req.body.topics];
          } catch (e) {
            topicsList = req.body.topics.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (req.body["topics[]"]) {
          topicsList = Array.isArray(req.body["topics[]"]) ? req.body["topics[]"] : [req.body["topics[]"]];
        } else if (req.body.topic_tag || req.body.topic || req.body.ib_theme) {
          const single = req.body.topic_tag || req.body.topic || req.body.ib_theme;
          topicsList = [single];
        }

        if (topicsList.length === 0 || topicsList.includes("ALL") || topicsList.includes("Hepsi")) {
          topicsList = ["ALL"];
        }

        const topicsJson = JSON.stringify(topicsList);
        const primaryTopicTag = topicsList.includes("ALL") ? "ALL" : (topicsList[0] || "Genel");

        const docType = req.body.docType || req.body.doc_type || (
          (originalName.toLowerCase().includes('markscheme') || originalName.toLowerCase().includes('_ms') || originalName.toLowerCase().includes('mark scheme') || originalName.toLowerCase().includes('cevap') || originalName.toLowerCase().includes('cozum') || originalName.toLowerCase().includes('çözüm')) ? 'mark_scheme' :
          (originalName.toLowerCase().includes('paper') || originalName.toLowerCase().includes('exam') || originalName.toLowerCase().includes('soru') || originalName.toLowerCase().includes('deneme') || originalName.toLowerCase().includes('test')) ? 'question_paper' :
          (originalName.toLowerCase().includes('note') || originalName.toLowerCase().includes('not') || originalName.toLowerCase().includes('ozet') || originalName.toLowerCase().includes('özet') || originalName.toLowerCase().includes('summary')) ? 'notes' : 'other'
        );

        let insRes;
        try {
          insRes = await client.execute({
            sql: `INSERT INTO subject_files (folder_id, course_id, filename, original_name, mimetype, size, url, uploaded_by, topic_tag, topics, doc_type, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [folderId, folderId, filename, originalName, mimetype, size, url, authUser.id, primaryTopicTag, topicsJson, docType, new Date().toISOString()]
          });
        } catch (e) {
          insRes = await client.execute({
            sql: `INSERT INTO subject_files (folder_id, course_id, filename, original_name, mimetype, size, url, uploaded_by, topic_tag, topics, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [folderId, folderId, filename, originalName, mimetype, size, url, authUser.id, primaryTopicTag, topicsJson, new Date().toISOString()]
          });
        }

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
          topic_tag: primaryTopicTag,
          topics: topicsList,
          docType: docType,
          doc_type: docType,
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
