import { Express, Request, Response } from "express";

/**
 * Posts and Likes Controller
 * Handles post likes query, user list modal data, and interaction events.
 */
export function registerPostRoutes(
  app: Express,
  client: any,
  io?: any
) {
  // GET: Users who liked a specific post
  app.get("/api/posts/:postId/likes", async (req: Request, res: Response) => {
    try {
      const rawPostId = req.params.postId;
      const numPostId = Number(rawPostId);
      const postId = !isNaN(numPostId) ? numPostId : rawPostId;

      const likesRes = await client.execute({
        sql: `SELECT 
                l.id as like_id, 
                l.post_id, 
                l.user_id,
                u.id as user_id,
                u.username, 
                u.avatar, 
                u.color, 
                u.roles, 
                u.is_admin,
                u.status
              FROM likes l
              JOIN users u ON l.user_id = u.id
              WHERE l.post_id = ? OR l.post_id = ?
              ORDER BY l.id DESC`,
        args: [postId, String(rawPostId)]
      });

      const formattedLikes = (likesRes.rows || []).map((row: any) => ({
        id: Number(row.user_id),
        like_id: Number(row.like_id || row.id),
        user_id: Number(row.user_id),
        name: String(row.username || "Kullanıcı"),
        username: String(row.username || "Kullanıcı"),
        avatar: row.avatar || null,
        avatarUrl: row.avatar || null,
        color: row.color || null,
        role: row.roles ? (typeof row.roles === "string" ? row.roles : JSON.stringify(row.roles)) : null,
        roles: row.roles ? (typeof row.roles === "string" ? row.roles : JSON.stringify(row.roles)) : null,
        is_admin: Number(row.is_admin) === 1
      }));

      // Supports both direct array or wrapped object consumption
      if (req.query.format === "array") {
        return res.json(formattedLikes);
      }

      return res.json({
        success: true,
        postId,
        count: formattedLikes.length,
        likes: formattedLikes
      });
    } catch (err: any) {
      console.error("GET /api/posts/:postId/likes error:", err);
      return res.status(500).json({ error: "Beğenenler listesi alınamadı." });
    }
  });
}
