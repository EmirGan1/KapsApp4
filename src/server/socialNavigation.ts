import type { Express } from 'express';
import type { Client } from '@libsql/client';
import { positiveId, mentionRanges } from '../shared/socialNavigation';
export function registerSocialNavigation(app: Express, db: Client, io: any, auth: (req: any) => Promise<any>) {
  const route = (fn: any) => async (req: any, res: any) => {
    try { const user = await auth(req); if (!user) return res.sendStatus(401); await fn(req, res, user); }
    catch (error) { console.error('Social navigation:', error); res.status(500).json({ error: 'İşlem tamamlanamadı.' }); }
  };
  app.get('/api/social/users/resolve', route(async (req: any, res: any) => {
    const username = String(req.query.username || '').trim();
    if (!username || username.length > 255) return res.sendStatus(400);
    // Exact identity only: never navigate to the first fuzzy search result.
    const row = (await db.execute({ sql: 'SELECT id,username FROM users WHERE username=? COLLATE NOCASE LIMIT 1', args: [username] })).rows[0];
    if (!row) return res.status(404).json({ error: 'Bu kullanıcı profili bulunamadı.' });
    res.json({ id: Number(row.id), username: String(row.username) });
  }));
  app.post('/api/social/mentions/resolve', route(async(req:any,res:any)=>{
    const text=req.body?.text;
    if(typeof text!=='string'||text.length>50000)return res.sendStatus(400);
    if(!text.includes('@'))return res.json([]);
    const users=(await db.execute('SELECT id,username FROM users')).rows.map(row=>({id:Number(row.id),username:String(row.username)}));
    res.json(mentionRanges(text,users));
  }));
  app.get('/api/social/posts/:id', route(async (req: any, res: any, user: any) => {
    const id = positiveId(req.params.id); if (!id) return res.sendStatus(400);
    const row = (await db.execute({ sql: `SELECT p.*,u.username,u.avatar,u.color,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments_count,
      EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) AS is_liked
      FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=?`, args: [Number(user.id), id] })).rows[0];
    if (!row) return res.status(404).json({ error: 'Bu gönderi silinmiş veya artık mevcut değil.' });
    res.json({ ...row, is_liked: Boolean(row.is_liked) });
  }));
  app.post('/api/social/posts/:id/like', route(async (req: any, res: any, user: any) => {
    const id = positiveId(req.params.id); if (!id) return res.sendStatus(400);
    const tx = await db.transaction('write'); let notification: any = null;
    try {
      const post = (await tx.execute({ sql: 'SELECT user_id FROM posts WHERE id=?', args: [id] })).rows[0];
      if (!post) { await tx.rollback(); return res.sendStatus(404); }
      const like = (await tx.execute({ sql: 'SELECT id FROM likes WHERE post_id=? AND user_id=?', args: [id, Number(user.id)] })).rows[0];
      if (like) await tx.execute({ sql: 'DELETE FROM likes WHERE id=?', args: [like.id] });
      else {
        await tx.execute({ sql: 'INSERT INTO likes(post_id,user_id) VALUES(?,?)', args: [id, Number(user.id)] });
        if (Number(post.user_id) !== Number(user.id)) {
          const now = new Date().toISOString(), content = `${user.username} gönderini beğendi.`;
          const result = await tx.execute({ sql: "INSERT INTO notifications(user_id,type,content,read,sender_id,target_id,created_at) VALUES(?,'like',?,0,?,?,?)", args: [Number(post.user_id), content, Number(user.id), id, now] });
          notification = { id: Number(result.lastInsertRowid), user_id: Number(post.user_id), type: 'like', content, sender_id: Number(user.id), sender_username: user.username, target_id: id, read: 0, created_at: now };
        }
      }
      await tx.commit();
      if (notification) io.to(`dm-user:${notification.user_id}`).emit('new_notification', notification);
      io.emit('feed_updated'); res.json({ ok: true });
    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
  }));
}
