import {registerAyvalikWeather} from './ayvalikWeather';
import {resolveAyvalikUser} from "./ayvalikAuth";
import {initAyvalikRooms,registerAyvalikRooms} from "./ayvalikRooms";
import { Express, Request, Response } from "express";
import { Server, Socket } from "socket.io";

export async function initAyvalikCasTables(client: any) {
  try {
    await initAyvalikRooms(client);
    // 1. Ayvalık CAS Chat Messages
    await client.execute(`
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
    `);

    // 2. Ayvalık CAS Gallery
    await client.execute(`
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
    `);

    // 3. Ayvalık CAS Gallery Likes
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_gallery_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gallery_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(gallery_id, user_id)
      )
    `);

    // 4. Ayvalık CAS Reflections (Öğrenci Günlüğü & CAS Notları)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        day_number INTEGER NOT NULL,
        learning_outcome TEXT,
        reflection_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Ayvalık CAS Packing Checklist (Kişiye Özel Çanta Kontrolü)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ayvalik_cas_checklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        is_checked INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      )
    `);

  } catch (err) {
    console.error("[Ayvalık CAS] Database initialization error:", err);
    throw err;
  }
}

const isCasAdmin=(user:any)=>Number(user.is_admin)===1||String(user.username||'').trim().toLowerCase()==='emirgan';
const validMedia=(url:unknown)=>typeof url==='string'&&url.length<=2048&&((url.startsWith('/')&&!url.startsWith('//'))||/^https?:\/\//i.test(url));
const packingIds=new Set(['id_card','personal_headphones','raincoat','boots','spare_clothes','fleece','powerbank','chargers','medicines','notebook','water_bottle','return_clothes']);
export function registerAyvalikCasRoutes(app: Express, client: any, io?: Server) {
  // Helper to extract user from token
  registerAyvalikRooms(app,client,io);
  registerAyvalikWeather(app,client);
  const resolveUser = (req:Request)=>resolveAyvalikUser(req,client);

  // -------------------------------------------------------------
  // 1. MESSAGES ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/messages", async (req: Request, res: Response) => {
    try {
      if(!await resolveUser(req))return res.status(401).json({success:false,error:'Giriş yapmanız gerekiyor.'});
      const result = await client.execute({
        sql: "SELECT * FROM (SELECT * FROM ayvalik_cas_messages ORDER BY id DESC LIMIT 250) ORDER BY id ASC",
        args: []
      });
      return res.json({ success: true, messages: result.rows || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "Mesajlar yüklenemedi." });
    }
  });

  app.post("/api/ayvalik/messages", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { content, media_url, media_type, is_pinned } = req.body||{};
      if((content!=null&&typeof content!=='string')||(typeof content==='string'&&content.length>4000)||(media_url!=null&&!validMedia(media_url))||(media_type!=null&&!['image','video'].includes(media_type)))return res.status(400).json({success:false,error:'Geçersiz mesaj veya medya.'});
      if(is_pinned!=null&&![true,false,0,1].includes(is_pinned))return res.status(400).json({success:false,error:'Geçersiz sabitleme seçimi.'});
      if(is_pinned&&!isCasAdmin(user))return res.status(403).json({success:false,error:'Mesaj sabitlemek için yönetici yetkisi gerekli.'});
      if (!content?.trim() && !media_url) {
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
      return res.status(500).json({ success: false, error: "Mesaj gönderilemedi." });
    }
  });

  // -------------------------------------------------------------
  // 2. GALLERY ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/gallery", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if(!user)return res.status(401).json({success:false,error:'Giriş yapmanız gerekiyor.'});
      const currentUserId = Number(user.id);
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
      return res.status(500).json({ success: false, error: "Galeri yüklenemedi." });
    }
  });

  app.post("/api/ayvalik/gallery", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { media_url, media_type, caption, day_tag, location_tag } = req.body||{};
      if(!validMedia(media_url)||(media_type!=null&&!['image','video'].includes(media_type))||[[caption,1000],[day_tag,100],[location_tag,160]].some(([value,max])=>value!=null&&(typeof value!=='string'||value.length>Number(max))))return res.status(400).json({success:false,error:'Geçersiz galeri bilgileri.'});
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
      return res.status(500).json({ success: false, error: "Medya eklenemedi." });
    }
  });

  app.post("/api/ayvalik/gallery/:id/like", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const galleryId=Number(req.params.id),userId=Number(user.id);
      if(!Number.isSafeInteger(galleryId)||galleryId<1)return res.status(400).json({success:false,error:'Geçersiz medya.'});
      const tx=await client.transaction('write');let liked=false,newCount=0;
      try{
        const exists=await tx.execute({sql:'SELECT id FROM ayvalik_cas_gallery WHERE id=?',args:[galleryId]});
        if(!exists.rows.length){await tx.rollback();return res.status(404).json({success:false,error:'Medya bulunamadı.'});}
        const previous=await tx.execute({sql:'SELECT id FROM ayvalik_cas_gallery_likes WHERE gallery_id=? AND user_id=?',args:[galleryId,userId]});
        liked=!previous.rows.length;
        await tx.execute({sql:liked?'INSERT INTO ayvalik_cas_gallery_likes(gallery_id,user_id) VALUES(?,?)':'DELETE FROM ayvalik_cas_gallery_likes WHERE gallery_id=? AND user_id=?',args:[galleryId,userId]});
        await tx.execute({sql:'UPDATE ayvalik_cas_gallery SET likes_count=(SELECT COUNT(*) FROM ayvalik_cas_gallery_likes WHERE gallery_id=?) WHERE id=?',args:[galleryId,galleryId]});
        const count=await tx.execute({sql:'SELECT likes_count FROM ayvalik_cas_gallery WHERE id=?',args:[galleryId]});newCount=Number(count.rows[0].likes_count);await tx.commit();
      }catch(error){await tx.rollback();throw error;}finally{tx.close();}
      io?.emit('ayvalik:gallery_liked',{id:galleryId,likes_count:newCount});
      return res.json({success:true,liked,likes_count:newCount});
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "İşlem başarısız." });
    }
  });

  app.delete("/api/ayvalik/gallery/:id", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const galleryId=Number(req.params.id);
      if(!Number.isSafeInteger(galleryId)||galleryId<1)return res.status(400).json({success:false,error:'Geçersiz medya.'});
      const tx=await client.transaction('write');
      try{
        const item=await tx.execute({sql:'SELECT user_id FROM ayvalik_cas_gallery WHERE id=?',args:[galleryId]});
        if(!item.rows.length){await tx.rollback();return res.status(404).json({success:false,error:'Medya bulunamadı.'});}
        if(Number(item.rows[0].user_id)!==Number(user.id)&&!isCasAdmin(user)){await tx.rollback();return res.status(403).json({success:false,error:'Yalnızca kendi paylaşımını silebilirsin.'});}
        await tx.execute({sql:'DELETE FROM ayvalik_cas_gallery WHERE id=?',args:[galleryId]});await tx.execute({sql:'DELETE FROM ayvalik_cas_gallery_likes WHERE gallery_id=?',args:[galleryId]});await tx.commit();
      }catch(error){await tx.rollback();throw error;}finally{tx.close();}
      io?.emit('ayvalik:gallery_deleted',{id:galleryId});
      return res.json({success:true,message:'Medya silindi.'});
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "Silinemedi." });
    }
  });

  // -------------------------------------------------------------
  // 3. REFLECTIONS (KAZANIM GÜNLÜĞÜ) ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/reflections", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if(!user)return res.status(401).json({success:false,error:'Giriş yapmanız gerekiyor.'});
      const currentUserId = Number(user.id);
      
      const result = await client.execute({
        sql: "SELECT * FROM ayvalik_cas_reflections WHERE user_id = ? ORDER BY day_number ASC, id ASC",
        args: [currentUserId]
      });

      return res.json({ success: true, reflections: result.rows || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "Notlar yüklenemedi." });
    }
  });

  app.post("/api/ayvalik/reflections", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { day_number, learning_outcome, reflection_text } = req.body||{};
      if(![1,2,3].includes(day_number)||typeof reflection_text!=='string'||reflection_text.length>12000||(learning_outcome!=null&&(typeof learning_outcome!=='string'||learning_outcome.length>200)))return res.status(400).json({success:false,error:'Geçersiz günlük bilgileri.'});
      if (!reflection_text.trim()) {
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
      return res.status(500).json({ success: false, error: "Kayıt yapılamadı." });
    }
  });

  // -------------------------------------------------------------
  // 4. PACKING CHECKLIST ENDPOINTS
  // -------------------------------------------------------------
  app.get("/api/ayvalik/checklist", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error:'Giriş yapmanız gerekiyor.' });
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
      return res.status(500).json({ success: false, error: "Checklist alınamadı." });
    }
  });

  app.post("/api/ayvalik/checklist/toggle", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor." });
      }

      const { item_id, is_checked } = req.body||{};
      if (typeof item_id!=='string'||!packingIds.has(item_id)||typeof is_checked!=='boolean') {
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
      return res.status(500).json({ success: false, error: "Güncellenemedi." });
    }
  });
}
