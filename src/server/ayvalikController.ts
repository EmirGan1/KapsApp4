import { Express, Request, Response } from "express";
import { Server, Socket } from "socket.io";

export function initAyvalikCasTables(client: any) {
  try {
    // 1. Ayvalık CAS Chat Messages
    client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT,
        color TEXT,
        content TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT,
        is_pinned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // 2. Ayvalık CAS Gallery
    client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        user_avatar TEXT,
        user_color TEXT,
        media_url TEXT NOT NULL,
        media_type TEXT DEFAULT 'image',
        caption TEXT,
        day_tag TEXT,
        location_tag TEXT,
        likes_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // 3. Ayvalık CAS Gallery Likes
    client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_gallery_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gallery_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(gallery_id, user_id)
      )
    `).catch(() => {});

    // 4. Ayvalık CAS Reflections (Öğrenci Günlüğü & CAS Notları)
    client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        day_number INTEGER NOT NULL,
        learning_outcome TEXT,
        reflection_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // 5. Ayvalık CAS Packing Checklist (Kişiye Özel Çanta Kontrolü)
    client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_checklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        is_checked INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      )
    `).catch(() => {});

  } catch (err) {
    console.error("[Ayvalık CAS] Database initialization error:", err);
  }
}

export function registerAyvalikCasRoutes(app: Express, client: any, io?: Server) {
  // Helper to extract user from token
  const resolveUser = async (req: Request) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string || req.body?.token);
    if (!token) return null;
    try {
      const res = await client.execute({
        sql: "SELECT id, username, avatar, color, roles, is_admin FROM users WHERE token = ?",
        args: [token]
      });
      if (res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
    } catch {}
    return null;
  };

  // -------------------------------------------------------------
  // 1. MESSAGES ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/messages", async (req: Request, res: Response) => {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM ayvalik_cas_messages ORDER BY id ASC LIMIT 250",
        args: []
      });
      return res.json({ success: true, messages: result.rows || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Mesajlar yüklenemedi." });
    }
  });

  app.post("/api/ayvalik/messages", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { content, media_url, media_type, is_pinned } = req.body;
      if (!content && !media_url) {
        return res.status(400).json({ success: false, error: "Mesaj içeriği veya medya gereklidir." });
      }

      const insertRes = await client.execute({
        sql: `INSERT INTO ayvalik_cas_messages (sender_id, username, avatar, color, content, media_url, media_type, is_pinned)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        args: [
          user.id,
          user.username,
          user.avatar || null,
          user.color || null,
          content || "",
          media_url || null,
          media_type || null,
          is_pinned ? 1 : 0
        ]
      });

      const newMsg = insertRes.rows?.[0] || {
        id: Date.now(),
        sender_id: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
        content: content || "",
        media_url: media_url || null,
        media_type: media_type || null,
        is_pinned: is_pinned ? 1 : 0,
        created_at: new Date().toISOString()
      };

      if (io) {
        io.emit("ayvalik:new_message", newMsg);
      }

      return res.json({ success: true, message: newMsg });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Mesaj gönderilemedi." });
    }
  });

  // -------------------------------------------------------------
  // 2. GALLERY ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/gallery", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      const currentUserId = user ? Number(user.id) : 0;
      const dayFilter = req.query.day as string;
      const locationFilter = req.query.location as string;

      let sql = "SELECT * FROM ayvalik_cas_gallery";
      const conditions: string[] = [];
      const args: any[] = [];

      if (dayFilter && dayFilter !== "all") {
        conditions.push("day_tag = ?");
        args.push(dayFilter);
      }
      if (locationFilter && locationFilter !== "all") {
        conditions.push("location_tag = ?");
        args.push(locationFilter);
      }

      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY id DESC LIMIT 200";

      const result = await client.execute({ sql, args });

      // Fetch user's likes
      let userLikedIds: number[] = [];
      if (currentUserId > 0) {
        const likesRes = await client.execute({
          sql: "SELECT gallery_id FROM ayvalik_cas_gallery_likes WHERE user_id = ?",
          args: [currentUserId]
        });
        userLikedIds = (likesRes.rows || []).map((r: any) => Number(r.gallery_id));
      }

      const items = (result.rows || []).map((item: any) => ({
        ...item,
        is_liked: userLikedIds.includes(Number(item.id))
      }));

      return res.json({ success: true, items });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Galeri yüklenemedi." });
    }
  });

  app.post("/api/ayvalik/gallery", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { media_url, media_type, caption, day_tag, location_tag } = req.body;
      if (!media_url) {
        return res.status(400).json({ success: false, error: "Medya URL'si gereklidir." });
      }

      const insertRes = await client.execute({
        sql: `INSERT INTO ayvalik_cas_gallery (user_id, username, user_avatar, user_color, media_url, media_type, caption, day_tag, location_tag, likes_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0) RETURNING *`,
        args: [
          user.id,
          user.username,
          user.avatar || null,
          user.color || null,
          media_url,
          media_type || "image",
          caption || "",
          day_tag || "Genel / Yolculuk",
          location_tag || "Ayvalık"
        ]
      });

      const newItem = insertRes.rows?.[0] || {
        id: Date.now(),
        user_id: user.id,
        username: user.username,
        user_avatar: user.avatar,
        user_color: user.color,
        media_url,
        media_type: media_type || "image",
        caption: caption || "",
        day_tag: day_tag || "Genel / Yolculuk",
        location_tag: location_tag || "Ayvalık",
        likes_count: 0,
        is_liked: false,
        created_at: new Date().toISOString()
      };

      if (io) {
        io.emit("ayvalik:new_gallery_item", newItem);
      }

      return res.json({ success: true, item: newItem });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Medya eklenemedi." });
    }
  });

  app.post("/api/ayvalik/gallery/:id/like", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const galleryId = Number(req.params.id);
      const userId = Number(user.id);

      // Check existing like
      const checkLike = await client.execute({
        sql: "SELECT id FROM ayvalik_cas_gallery_likes WHERE gallery_id = ? AND user_id = ?",
        args: [galleryId, userId]
      });

      let liked = false;
      if (checkLike.rows && checkLike.rows.length > 0) {
        // Unlike
        await client.execute({
          sql: "DELETE FROM ayvalik_cas_gallery_likes WHERE gallery_id = ? AND user_id = ?",
          args: [galleryId, userId]
        });
        await client.execute({
          sql: "UPDATE ayvalik_cas_gallery SET likes_count = MAX(0, likes_count - 1) WHERE id = ?",
          args: [galleryId]
        });
        liked = false;
      } else {
        // Like
        await client.execute({
          sql: "INSERT INTO ayvalik_cas_gallery_likes (gallery_id, user_id) VALUES (?, ?)",
          args: [galleryId, userId]
        });
        await client.execute({
          sql: "UPDATE ayvalik_cas_gallery SET likes_count = likes_count + 1 WHERE id = ?",
          args: [galleryId]
        });
        liked = true;
      }

      const updated = await client.execute({
        sql: "SELECT likes_count FROM ayvalik_cas_gallery WHERE id = ?",
        args: [galleryId]
      });
      const newCount = updated.rows?.[0]?.likes_count ?? 0;

      if (io) {
        io.emit("ayvalik:gallery_liked", { id: galleryId, likes_count: newCount });
      }

      return res.json({ success: true, liked, likes_count: newCount });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "İşlem başarısız." });
    }
  });

  app.delete("/api/ayvalik/gallery/:id", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const galleryId = Number(req.params.id);
      const isOwnerOrAdmin = (user.username || "").toLowerCase() === "emirgan" || Number(user.is_admin) === 1;

      if (isOwnerOrAdmin) {
        await client.execute({ sql: "DELETE FROM ayvalik_cas_gallery WHERE id = ?", args: [galleryId] });
      } else {
        await client.execute({ sql: "DELETE FROM ayvalik_cas_gallery WHERE id = ? AND user_id = ?", args: [galleryId, user.id] });
      }

      await client.execute({ sql: "DELETE FROM ayvalik_cas_gallery_likes WHERE gallery_id = ?", args: [galleryId] });

      if (io) {
        io.emit("ayvalik:gallery_deleted", { id: galleryId });
      }

      return res.json({ success: true, message: "Medya başarıyla silindi." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Silinemedi." });
    }
  });

  // -------------------------------------------------------------
  // 3. REFLECTIONS (KAZANIM GÜNLÜĞÜ) ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/reflections", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      const currentUserId = user ? Number(user.id) : 0;
      
      const result = await client.execute({
        sql: "SELECT * FROM ayvalik_cas_reflections WHERE user_id = ? ORDER BY day_number ASC, id ASC",
        args: [currentUserId]
      });

      return res.json({ success: true, reflections: result.rows || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Notlar yüklenemedi." });
    }
  });

  app.post("/api/ayvalik/reflections", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { day_number, learning_outcome, reflection_text } = req.body;
      if (!reflection_text) {
        return res.status(400).json({ success: false, error: "Değerlendirme notu boş bırakılamaz." });
      }

      const insertRes = await client.execute({
        sql: `INSERT INTO ayvalik_cas_reflections (user_id, username, day_number, learning_outcome, reflection_text)
              VALUES (?, ?, ?, ?, ?) RETURNING *`,
        args: [
          user.id,
          user.username,
          Number(day_number) || 1,
          learning_outcome || "Service / Toplum Hizmeti",
          reflection_text
        ]
      });

      return res.json({ success: true, reflection: insertRes.rows?.[0] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Kayıt yapılamadı." });
    }
  });

  // -------------------------------------------------------------
  // 4. PACKING CHECKLIST ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/checklist", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.json({ success: true, checkedIds: [] });
      }

      const resDb = await client.execute({
        sql: "SELECT item_id, is_checked FROM ayvalik_cas_checklist WHERE user_id = ?",
        args: [user.id]
      });

      const checkedIds = (resDb.rows || [])
        .filter((r: any) => Number(r.is_checked) === 1)
        .map((r: any) => String(r.item_id));

      return res.json({ success: true, checkedIds });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Checklist alınamadı." });
    }
  });

  app.post("/api/ayvalik/checklist/toggle", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { item_id, is_checked } = req.body;
      if (!item_id) {
        return res.status(400).json({ success: false, error: "Öğe ID'si gereklidir." });
      }

      await client.execute({
        sql: `INSERT INTO ayvalik_cas_checklist (user_id, item_id, is_checked, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id, item_id) DO UPDATE SET is_checked = excluded.is_checked, updated_at = CURRENT_TIMESTAMP`,
        args: [user.id, String(item_id), is_checked ? 1 : 0]
      });

      return res.json({ success: true, item_id, is_checked: Boolean(is_checked) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Güncellenemedi." });
    }
  });
}
