import { Express, Request, Response } from "express";

/**
 * Screen Time and Admin Dashboard Leaderboard Controller
 */

export function registerAdminController(app: Express, client: any, requireEmirganAdmin: any, io?: any) {
  
  // ==========================================
  // EMİRGAN YÖNETİMİ: GÜNÜN SÖZÜ (DAILY QUOTE)
  // ==========================================

  // Public: Get active daily quote
  app.get("/api/public/daily-quote", async (req: Request, res: Response) => {
    try {
      const quoteRes = await client.execute("SELECT * FROM daily_quotes ORDER BY id DESC LIMIT 1");
      if (quoteRes.rows.length === 0) {
        return res.json({
          quote_text: "Büyük hedeflere giden yol, bugünün küçük adımlarıyla başlar.",
          author: "Emirgan",
          updated_at: new Date().toISOString()
        });
      }
      const row = quoteRes.rows[0];
      return res.json({
        id: row.id,
        quote_text: row.quote_text,
        author: row.author || "",
        updated_by: row.updated_by || "emirgan",
        updated_at: row.updated_at
      });
    } catch (e: any) {
      console.error("[DailyQuote] Error fetching daily quote:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // Admin: Update daily quote
  app.put("/api/admin/daily-quote", requireEmirganAdmin, async (req: Request, res: Response) => {
    try {
      const { quote_text, author } = req.body;
      if (!quote_text || typeof quote_text !== "string" || !quote_text.trim()) {
        return res.status(400).json({ error: "Söz metni boş bırakılamaz." });
      }

      const cleanText = quote_text.trim();
      const cleanAuthor = typeof author === "string" ? author.trim() : "";
      const updatedBy = req.headers["x-username"] || "emirgan";

      await client.execute({
        sql: "INSERT INTO daily_quotes (quote_text, author, updated_by) VALUES (?, ?, ?)",
        args: [cleanText, cleanAuthor, String(updatedBy)]
      });

      const updatedQuote = {
        quote_text: cleanText,
        author: cleanAuthor,
        updated_by: String(updatedBy),
        updated_at: new Date().toISOString()
      };

      // Realtime push to all connected users
      if (io) {
        io.emit("quote_updated", updatedQuote);
      }

      return res.json({
        success: true,
        message: "Günün sözü başarıyla güncellendi ve tüm kullanıcılara canlı yansıtıldı.",
        quote: updatedQuote
      });
    } catch (e: any) {
      console.error("[DailyQuote] Error updating daily quote:", e);
      return res.status(500).json({ error: e.message });
    }
  });
  
  // Endpoint to track user screen time (heartbeat)
  app.post("/api/user/screen-time", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ error: "Oturum açmalısınız." });
      }

      const userRes = await client.execute({
        sql: "SELECT id, username FROM users WHERE token = ?",
        args: [token]
      });

      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: "Geçersiz oturum." });
      }

      const user = userRes.rows[0];
      const seconds = Math.min(60, Math.max(1, Number(req.body.seconds) || 15)); // limit seconds interval to 1-60s
      
      // Get today's date in local time YYYY-MM-DD
      const dateStr = new Date().toLocaleDateString("en-CA"); // Always YYYY-MM-DD

      // INSERT OR IGNORE, then UPDATE to be safe
      await client.execute({
        sql: "INSERT OR IGNORE INTO user_daily_screen_time (user_id, date, total_seconds, last_active_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)",
        args: [user.id, dateStr]
      });

      await client.execute({
        sql: "UPDATE user_daily_screen_time SET total_seconds = total_seconds + ?, last_active_at = CURRENT_TIMESTAMP WHERE user_id = ? AND date = ?",
        args: [seconds, user.id, dateStr]
      });

      return res.json({ success: true, today_date: dateStr });
    } catch (e: any) {
      console.error("[ScreenTime] Error tracking screen time:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // GET: Current user's daily screen time (today)
  app.get("/api/user/my-screen-time", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Yetkisiz erişim" });
      const token = authHeader.replace("Bearer ", "").trim();
      const userRes = await client.execute({
        sql: "SELECT id FROM users WHERE token = ?",
        args: [token]
      });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum" });

      const dateStr = new Date().toLocaleDateString("en-CA");
      const stRes = await client.execute({
        sql: "SELECT total_seconds FROM user_daily_screen_time WHERE user_id = ? AND date = ?",
        args: [userRes.rows[0].id, dateStr]
      });
      const totalSeconds = Number(stRes.rows[0]?.total_seconds || 0);
      return res.json({ today_seconds: totalSeconds, date: dateStr });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET: Screen time leaderboard for Admin Panel (Emirgan)
  app.get("/api/admin/screen-time-leaderboard", requireEmirganAdmin, async (req: Request, res: Response) => {
    try {
      const range = req.query.range || "all"; // "today", "week", "all"
      
      // We JOIN users and user_daily_screen_time. To prevent database errors,
      // we make sure u.name and u.avatar_url are handled gracefully by checking u.username and u.avatar
      const leaderboardRes = await client.execute({
        sql: `
          SELECT 
            u.id AS user_id,
            u.username,
            COALESCE(u.name, u.username) AS name,
            COALESCE(u.avatar, u.avatar_url, '') AS avatar_url,
            u.color,
            COALESCE(SUM(st.total_seconds), 0) AS total_seconds,
            MAX(st.last_active_at) AS last_seen
          FROM users u
          LEFT JOIN user_daily_screen_time st ON u.id = st.user_id
          WHERE (? = 'all' 
            OR (? = 'today' AND st.date = DATE('now', 'localtime')) 
            OR (? = 'week' AND st.date >= DATE('now', '-7 days', 'localtime'))
          )
          GROUP BY u.id
          ORDER BY total_seconds DESC
        `,
        args: [range, range, range]
      });

      return res.json({ leaderboard: leaderboardRes.rows });
    } catch (e: any) {
      console.error("[EMIRGAN ADMIN] Screen time leaderboard error:", e);
      return res.status(500).json({ error: "Liderlik tablosu alınamadı: " + e.message });
    }
  });
}
