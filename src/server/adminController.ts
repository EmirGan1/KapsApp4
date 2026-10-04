import { Express, Request, Response } from "express";

/**
 * Screen Time and Admin Dashboard Leaderboard Controller
 */

export function registerAdminController(app: Express, client: any, requireEmirganAdmin: any) {
  
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
