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

export async function getAuthUserFromRequest(req: Request, client: any) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : ((req.query.token as string) || (req.body?.token as string) || "");

    const xUsername = (
      (req.headers["x-username"] as string) ||
      (req.headers["username"] as string) ||
      (req.query.username as string) ||
      ""
    ).trim();

    if (token) {
      const userRes = await client.execute({
        sql: "SELECT id, username, avatar, color, is_admin, role FROM users WHERE token = ?",
        args: [token]
      });
      if (userRes.rows.length > 0) return userRes.rows[0];
    }

    if (xUsername) {
      const userRes = await client.execute({
        sql: "SELECT id, username, avatar, color, is_admin, role FROM users WHERE LOWER(username) = LOWER(?)",
        args: [xUsername]
      });
      if (userRes.rows.length > 0) return userRes.rows[0];
    }

    return null;
  } catch {
    return null;
  }
}

export function isEmirganOrRootAdmin(user: any): boolean {
  if (!user) return false;
  const uname = String(user.username || "").trim().toLowerCase();
  const role = String(user.role || "").trim().toUpperCase();
  return (
    uname === "emirgan" ||
    role === "ROOT" ||
    role === "ADMIN" ||
    Number(user.is_admin) === 1 ||
    String(user.is_admin) === "1"
  );
}

export function registerCourseRoutes(
  app: Express,
  client: any,
  upload: any,
  io: any,
  deleteUploadedFile: (filePath: string) => Promise<void>
) {
  // Ensure 'topics', 'doc_type', and 'download_count' columns exist in subject_files
  client.execute("ALTER TABLE subject_files ADD COLUMN topics TEXT").catch(() => {});
  client.execute("ALTER TABLE subject_files ADD COLUMN doc_type TEXT").catch(() => {});
  client.execute("ALTER TABLE subject_files ADD COLUMN download_count INTEGER DEFAULT 0").catch(() => {});

  // Ensure file_downloads audit log table exists with proper indexes
  client.execute(`
    CREATE TABLE IF NOT EXISTS file_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      user_id INTEGER NULL,
      username TEXT NOT NULL,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT NULL
    )
  `).catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_file_downloads_file_id ON file_downloads(file_id)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_file_downloads_downloaded_at ON file_downloads(downloaded_at DESC)").catch(() => {});

  // Database Migration: Update the two requested Math files to 'question_paper'
  client.execute(`
    UPDATE subject_files 
    SET doc_type = 'question_paper' 
    WHERE original_name LIKE '%AA_HL_2025_May-Nov_Paper2_Sorulari_Markscheme%' 
       OR original_name LIKE '%AA_HL_Paper1_Mayis2026_Konu_Sorulari_Markscheme%' 
       OR filename LIKE '%AA_HL_2025_May-Nov_Paper2_Sorulari_Markscheme%' 
       OR filename LIKE '%AA_HL_Paper1_Mayis2026_Konu_Sorulari_Markscheme%'
  `).catch(() => {});

  // GET: List files for course / subject (Supports multi-topic filter & ALL topic)
  app.get(["/api/courses/:courseId/files", "/api/subjects/:courseId/files"], async (req: Request, res: Response) => {
    try {
      const folderId = req.params.courseId;
      const requestedTopic = (req.query.topic || req.query.theme) as string | undefined;

      // Access control: only emirgan or ROOT/ADMIN can see download_count
      const authUser = await getAuthUserFromRequest(req, client);
      const canViewDownloadCount = isEmirganOrRootAdmin(authUser);

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
          const hasMS = origLower.includes('markscheme') || origLower.includes('_ms') || origLower.includes('ms.') || origLower.includes('mark scheme') || origLower.includes('cevap') || origLower.includes('cozum') || origLower.includes('çözüm');
          const hasQP = origLower.includes('paper') || origLower.includes('exam') || origLower.includes('soru') || origLower.includes('deneme') || origLower.includes('test');
          if (hasMS && hasQP) {
            docType = 'both';
          } else if (hasMS) {
            docType = 'mark_scheme';
          } else if (hasQP) {
            docType = 'question_paper';
          } else if (origLower.includes('note') || origLower.includes('not') || origLower.includes('ozet') || origLower.includes('özet') || origLower.includes('summary')) {
            docType = 'notes';
          } else {
            docType = 'other';
          }
        }

        const cleanObj: any = {
          ...row,
          topics: topicsArray,
          topic_tag: primaryTag,
          docType: docType,
          doc_type: docType
        };

        // Strictly omit download_count for non-emirgan / non-ROOT users
        if (canViewDownloadCount) {
          cleanObj.download_count = Number(row.download_count || 0);
        } else {
          delete cleanObj.download_count;
        }

        return cleanObj;
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

  // GET: Download file with audit logging & counter increment
  app.get(
    [
      "/api/files/:id/download",
      "/api/courses/files/:id/download",
      "/api/subjects/files/:id/download"
    ],
    async (req: Request, res: Response) => {
      try {
        const rawId = req.params.id;
        const numId = Number(rawId);
        const isNum = !isNaN(numId);

        let fileRes = await client.execute({
          sql: "SELECT * FROM subject_files WHERE id = ? OR filename = ?",
          args: [isNum ? numId : rawId, String(rawId)]
        });

        if (fileRes.rows.length === 0) {
          fileRes = await client.execute({
            sql: "SELECT * FROM uploaded_files WHERE id = ? OR filename = ?",
            args: [isNum ? numId : rawId, String(rawId)]
          });
        }

        if (fileRes.rows.length === 0) {
          return res.status(404).json({ error: "İndirilecek dosya bulunamadı." });
        }

        const fileObj = fileRes.rows[0];
        const fileIdNum = Number(fileObj.id);

        // 1. Identify downloading user (authenticated or anonymous student)
        const authUser = await getAuthUserFromRequest(req, client);
        const userId = authUser ? Number(authUser.id) : null;
        const username = authUser?.username ? String(authUser.username).trim() : "Anonim Öğrenci";
        
        // 2. Identify IP address (5651 & security audit)
        const rawIp =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket.remoteAddress ||
          "Bilinmiyor";
        const ipAddress = rawIp.replace(/^::ffff:/, "");

        // 3. Record download in file_downloads audit log
        try {
          await client.execute({
            sql: "INSERT INTO file_downloads (file_id, user_id, username, downloaded_at, ip_address) VALUES (?, ?, ?, ?, ?)",
            args: [fileIdNum, userId, username, new Date().toISOString(), ipAddress]
          });
        } catch (logErr) {
          console.error("Failed to insert file_downloads log:", logErr);
        }

        // 4. Increment download_count in subject_files
        try {
          await client.execute({
            sql: "UPDATE subject_files SET download_count = COALESCE(download_count, 0) + 1 WHERE id = ?",
            args: [fileIdNum]
          });
        } catch (cntErr) {
          console.error("Failed to increment download_count:", cntErr);
        }

        // 5. Broadcast updated count in real-time
        try {
          const countRes = await client.execute({
            sql: "SELECT download_count FROM subject_files WHERE id = ?",
            args: [fileIdNum]
          });
          const newCount = Number(countRes.rows[0]?.download_count || 1);
          io.emit("file:downloaded", {
            fileId: fileIdNum,
            download_count: newCount,
            folderId: fileObj.folder_id || fileObj.course_id
          });
        } catch (emitErr) {}

        // 6. Deliver file with Content-Disposition header
        const filename = fileObj.filename;
        const originalName = fileObj.original_name || fileObj.filename || "dosya.bin";
        const uploadsDir = path.join(process.cwd(), "uploads");
        const filePath = path.join(uploadsDir, filename);

        const safeFilename = originalName.replace(/["\r\n\\]/g, "_");
        const encodedFilename = encodeURIComponent(originalName);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`
        );
        if (fileObj.mimetype) {
          res.setHeader("Content-Type", fileObj.mimetype);
        }

        if (fs.existsSync(filePath)) {
          const stream = fs.createReadStream(filePath);
          return stream.pipe(res);
        }

        // Fallback: restore from database if cached
        const backupRes = await client.execute({
          sql: "SELECT data, mimetype FROM uploaded_files WHERE filename = ?",
          args: [filename]
        });

        if (backupRes.rows.length > 0 && backupRes.rows[0].data) {
          const buffer = Buffer.from(backupRes.rows[0].data as string, "base64");
          try {
            fs.writeFileSync(filePath, buffer);
          } catch (e) {}
          res.setHeader("Content-Length", buffer.length);
          return res.send(buffer);
        }

        return res.status(404).json({ error: "Dosya fiziksel depolamada bulunamadı." });
      } catch (err: any) {
        console.error("File download error:", err);
        return res.status(500).json({ error: "Dosya indirilirken hata oluştu: " + err.message });
      }
    }
  );

  // GET: Detailed Download History (Audit Log) - EXCLUSIVELY FOR EMIRGAN / ROOT
  app.get(
    [
      "/api/files/:id/download-logs",
      "/api/courses/files/:id/download-logs",
      "/api/subjects/files/:id/download-logs"
    ],
    async (req: Request, res: Response) => {
      try {
        const authUser = await getAuthUserFromRequest(req, client);
        if (!isEmirganOrRootAdmin(authUser)) {
          return res.status(403).json({ error: "Bu işlem için yetkiniz bulunmamaktadır. Yalnızca emirgan veya ROOT görebilir." });
        }

        const rawId = req.params.id;
        const numId = Number(rawId);
        const isNum = !isNaN(numId);

        let fileRes = await client.execute({
          sql: "SELECT id, filename, original_name, download_count FROM subject_files WHERE id = ? OR filename = ?",
          args: [isNum ? numId : rawId, String(rawId)]
        });

        if (fileRes.rows.length === 0) {
          fileRes = await client.execute({
            sql: "SELECT id, filename, original_name, download_count FROM uploaded_files WHERE id = ? OR filename = ?",
            args: [isNum ? numId : rawId, String(rawId)]
          });
        }

        if (fileRes.rows.length === 0) {
          return res.status(404).json({ error: "Dosya bulunamadı." });
        }

        const fileObj = fileRes.rows[0];
        const fileIdNum = Number(fileObj.id);
        const totalDownloads = Number(fileObj.download_count || 0);

        // Fetch logs with uploader user profile info
        const logsRes = await client.execute({
          sql: `SELECT d.id, d.file_id, d.user_id, d.username, d.downloaded_at, d.ip_address,
                       u.avatar as user_avatar, u.color as user_color, u.role as user_role
                FROM file_downloads d
                LEFT JOIN users u ON d.user_id = u.id
                WHERE d.file_id = ?
                ORDER BY d.downloaded_at DESC
                LIMIT 100`,
          args: [fileIdNum]
        });

        const totalLogsCountRes = await client.execute({
          sql: "SELECT COUNT(*) as cnt FROM file_downloads WHERE file_id = ?",
          args: [fileIdNum]
        });
        const totalLogsInDb = Number(totalLogsCountRes.rows[0]?.cnt || 0);

        // Distinct users count
        const uniqueUsernames = new Set(
          logsRes.rows.map((r: any) => String(r.username || "").trim().toLowerCase())
        );
        const uniqueDownloadersCount = uniqueUsernames.size;

        // Graceful fallback: pre-feature downloads count
        const preFeatureCount = Math.max(0, totalDownloads - totalLogsInDb);

        return res.json({
          file_id: fileIdNum,
          original_name: fileObj.original_name || fileObj.filename,
          total_downloads: totalDownloads,
          unique_downloaders_count: uniqueDownloadersCount,
          pre_feature_count: preFeatureCount,
          logs: logsRes.rows.map((r: any) => ({
            id: Number(r.id),
            file_id: Number(r.file_id),
            user_id: r.user_id ? Number(r.user_id) : null,
            username: r.username,
            downloaded_at: r.downloaded_at,
            ip_address: r.ip_address || null,
            user_avatar: r.user_avatar || null,
            user_color: r.user_color || null,
            user_role: r.user_role || null
          }))
        });
      } catch (err: any) {
        console.error("GET download-logs error:", err);
        return res.status(500).json({ error: "İndirme geçmişi alınamadı: " + err.message });
      }
    }
  );

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
        const xUsername = (req.headers["x-username"] as string)?.trim() || (req.headers["username"] as string)?.trim();

        let authUser: any = null;
        if (token) {
          const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE token = ?", args: [token] });
          if (userRes.rows.length > 0) authUser = userRes.rows[0];
        }

        if (!authUser && xUsername) {
          const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE LOWER(username) = LOWER(?)", args: [xUsername] });
          if (userRes.rows.length > 0) authUser = userRes.rows[0];
        }

        if (!authUser) {
          const fallbackRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users ORDER BY id ASC LIMIT 1" });
          if (fallbackRes.rows.length > 0) authUser = fallbackRes.rows[0];
        }

        if (!authUser) return res.status(401).json({ error: "Giriş yapmalısınız." });

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

        const origLower = originalName.toLowerCase();
        const hasMS = origLower.includes('markscheme') || origLower.includes('_ms') || origLower.includes('ms.') || origLower.includes('mark scheme') || origLower.includes('cevap') || origLower.includes('cozum') || origLower.includes('çözüm');
        const hasQP = origLower.includes('paper') || origLower.includes('exam') || origLower.includes('soru') || origLower.includes('deneme') || origLower.includes('test');

        const docType = req.body.docType || req.body.doc_type || (
          (hasMS && hasQP) ? 'both' :
          hasMS ? 'mark_scheme' :
          hasQP ? 'question_paper' :
          (origLower.includes('note') || origLower.includes('not') || origLower.includes('ozet') || origLower.includes('özet') || origLower.includes('summary')) ? 'notes' : 'other'
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
      const xUsername = (req.headers["x-username"] as string)?.trim() || (req.headers["username"] as string)?.trim();

      let authUser: any = null;
      if (token) {
        const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE token = ?", args: [token] });
        if (userRes.rows.length > 0) authUser = userRes.rows[0];
      }

      if (!authUser && xUsername) {
        const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE LOWER(username) = LOWER(?)", args: [xUsername] });
        if (userRes.rows.length > 0) authUser = userRes.rows[0];
      }

      if (!authUser) {
        const fallbackRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users ORDER BY id ASC LIMIT 1" });
        if (fallbackRes.rows.length > 0) authUser = fallbackRes.rows[0];
      }

      if (!authUser) return res.status(401).json({ error: "Giriş yapmalısınız." });

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
