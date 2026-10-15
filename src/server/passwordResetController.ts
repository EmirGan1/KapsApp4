import type { Express, Request, Response, RequestHandler } from 'express';
import type { Client, Row } from '@libsql/client';
import type { Server } from 'socket.io';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const keyValid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const resetToken = (key: string, id: string) => crypto.createHmac('sha256', key).update(`password-reset:${id}`).digest('hex');
const isRoot = (u: Row) => String(u.username).trim().toLowerCase() === 'emirgan' || String(u.role).toUpperCase() === 'ROOT';
const eligible = (u: Row) => !Number(u.isBanned) && !Number(u.is_banned) && (!u.status || u.status === 'approved');

export async function initPasswordResetDb(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS password_reset_requests (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, requester_hash TEXT NOT NULL,
    reset_token_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK(status IN ('PENDING','APPROVED','REJECTED','COMPLETED','CANCELLED','EXPIRED')),
    requested_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    decided_by INTEGER
  )`);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_active_user
    ON password_reset_requests(user_id) WHERE status IN ('PENDING','APPROVED')`);
  // Old links were issued without identity verification. Never accept them again.
  await client.execute('UPDATE password_resets SET used = 1 WHERE used = 0');
  const columns = await client.execute('PRAGMA table_info(users)');
  if (columns.rows.some(column => column.name === 'reset_token')) {
    // Also revoke tokens issued by the former username-only approval flow.
    await client.execute("UPDATE users SET reset_status='NONE', reset_token=NULL WHERE reset_token IS NOT NULL OR reset_status!='NONE'");
  }
}

export function registerPasswordResetRoutes(app: Express, client: Client, io: Server, invalidateUser: (id: number) => void) {
  const wrap = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    handler(req, res).catch(err => {
      console.error('[Password reset]', err instanceof Error ? err.message : 'Unexpected error');
      if (!res.headersSent) res.status(500).json({ error: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' });
    });
  };
  const syncNotifications = async () => {
    await client.execute(`UPDATE notifications SET
      metadata=json_set(metadata,'$.status',(SELECT r.status FROM password_reset_requests r WHERE r.id=json_extract(notifications.metadata,'$.requestId'))), read=1
      WHERE type='PASSWORD_RESET_REQUEST' AND json_valid(metadata)
      AND EXISTS (SELECT 1 FROM password_reset_requests r WHERE r.id=json_extract(notifications.metadata,'$.requestId')
        AND r.status!='PENDING' AND r.status!=COALESCE(json_extract(notifications.metadata,'$.status'),''))`);
  };
  const expire = async () => {
    await client.execute({ sql: `UPDATE password_reset_requests SET status = 'EXPIRED', updated_at = ?
      WHERE status IN ('PENDING','APPROVED') AND expires_at <= ?`, args: [new Date().toISOString(), new Date().toISOString()] });
    await syncNotifications();
  };
  const notifyAdmins = () => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.user && isRoot(socket.data.user)) {
        socket.emit('password_reset_updated');
        socket.emit('notifications_updated');
      }
    }
  };
  const admin = async (req: Request): Promise<Row | undefined> => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return;
    const users = await client.execute({ sql: `SELECT u.* FROM users u WHERE u.token = ? OR EXISTS
      (SELECT 1 FROM user_sessions s WHERE s.user_id = u.id AND s.token = ? AND (s.expires_at IS NULL OR s.expires_at > ?))`,
      args: [token, token, new Date().toISOString()] });
    const user = users.rows[0];
    return user && eligible(user) && isRoot(user) ? user : undefined;
  };
  // Bounded per-IP windows; do not trust a caller-controlled fingerprint for throttling.
  const limits = new Map<string, { count: number; until: number }>();
  const limited = (req: Request, res: Response, category: string, max: number) => {
    const now = Date.now();
    for (const [key, entry] of limits) if (entry.until < now) limits.delete(key);
    const key = `${category}:${req.ip || req.socket.remoteAddress}`;
    const entry = limits.get(key) || { count: 0, until: now + 15 * 60_000 };
    entry.count++;
    limits.set(key, entry);
    if (entry.count <= max) return false;
    res.setHeader('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
    res.status(429).json({ error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' });
    return true;
  };
  const owned = async (username: unknown, key: unknown) => {
    if (typeof username !== 'string' || !keyValid(key)) return;
    await expire();
    const result = await client.execute({ sql: `SELECT r.*, u.username, u.role, u.isBanned, u.is_banned, u.status AS account_status
      FROM password_reset_requests r JOIN users u ON u.id = r.user_id
      WHERE LOWER(u.username) = LOWER(?) AND r.requester_hash = ? ORDER BY r.requested_at DESC, r.rowid DESC LIMIT 1`,
      args: [username.trim(), sha(key)] });
    const row = result.rows[0];
    return row && !isRoot(row) && eligible({ ...row, status: row.account_status }) ? row : undefined;
  };
  const statusResponse = (row: Row, key: string) => ({
    status: row.status, requestId: row.id, username: row.username,
    ...(row.status === 'APPROVED' ? { requirePasswordReset: true, resetToken: resetToken(key, String(row.id)) } : {})
  });

  app.post(['/api/auth/request-password-reset', '/api/auth/forgot-password', '/api/forgot-password'], wrap(async (req, res) => {
    if (limited(req, res, 'request', 10)) return;
    const { username, requesterKey } = req.body;
    if (typeof username !== 'string' || !username.trim() || username.length > 255 || !keyValid(requesterKey)) {
      return res.status(400).json({ error: 'Kullanıcı adı ve bu tarayıcıya ait sıfırlama anahtarı gerekli.' });
    }
    await expire();
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE LOWER(username) = LOWER(?)', args: [username.trim()] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (isRoot(user) || !eligible(user)) return res.status(403).json({ error: 'Bu hesap için dışarıdan şifre sıfırlama talebi oluşturulamaz.' });
    const existing = await client.execute({ sql: `SELECT r.*, u.username FROM password_reset_requests r JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ? AND r.status IN ('PENDING','APPROVED')`, args: [user.id] });
    if (existing.rows[0]) {
      if (existing.rows[0].requester_hash !== sha(requesterKey)) return res.status(409).json({ error: 'Bu hesap için başka bir tarayıcıdan gönderilmiş açık bir talep var. Yöneticiyle iletişime geçin.' });
      return res.json({ success: true, ...statusResponse(existing.rows[0], requesterKey) });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const tx = await client.transaction('write');
    try {
      await tx.execute({ sql: `INSERT INTO password_reset_requests
        (id,user_id,requester_hash,reset_token_hash,requested_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?)`,
        args: [id, user.id, sha(requesterKey), sha(resetToken(requesterKey, id)), now, now, new Date(Date.now() + 24 * 60 * 60_000).toISOString()] });
      const admins = await tx.execute(`SELECT id FROM users WHERE LOWER(TRIM(username)) = 'emirgan' OR UPPER(role) = 'ROOT'`);
      if (!admins.rows.length) throw new Error('No recovery administrator configured');
      for (const root of admins.rows) await tx.execute({ sql: `INSERT INTO notifications
        (user_id,type,content,read,target_id,metadata,created_at) VALUES (?,'PASSWORD_RESET_REQUEST',?,0,?,?,?)`,
        args: [root.id, `🔑 @${user.username} şifresini sıfırlamak için onayınızı bekliyor.`, user.id,
          JSON.stringify({ requestId: id, targetUserId: user.id, targetUsername: user.username, status: 'PENDING' }), now] });
      await tx.commit();
    } finally { tx.close(); }
    notifyAdmins();
    return res.json({ success: true, status: 'PENDING', requestId: id, username: user.username });
  }));

  app.get('/api/auth/password-reset-status/:username', wrap(async (req, res) => {
    if (limited(req, res, 'status', 400)) return;
    const key = req.headers['x-password-reset-key'];
    const row = await owned(req.params.username, key);
    if (!row || !keyValid(key)) return res.status(403).json({ error: 'Talep bu tarayıcıda bulunamadı veya artık geçerli değil.' });
    return res.json(statusResponse(row, key));
  }));

  app.get('/api/admin/password-reset/requests', wrap(async (req, res) => {
    if (!await admin(req)) return res.status(403).json({ error: 'Yalnızca emirgan veya ROOT bu işlemi yapabilir.' });
    await expire();
    const result = await client.execute(`SELECT r.id, r.user_id, u.username, r.status, r.requested_at, r.expires_at
      FROM password_reset_requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'PENDING' ORDER BY r.requested_at ASC`);
    return res.json({ requests: result.rows });
  }));

  app.post('/api/admin/password-reset/decide', wrap(async (req, res) => {
    const root = await admin(req);
    if (!root) return res.status(403).json({ error: 'Yalnızca emirgan veya ROOT bu işlemi yapabilir.' });
    const { requestId, decision } = req.body;
    if (typeof requestId !== 'string' || !['APPROVE','REJECT'].includes(decision)) return res.status(400).json({ error: 'Talep ve karar geçersiz.' });
    await expire();
    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const tx = await client.transaction('write');
    try {
      const target = await tx.execute({ sql: `SELECT r.*,u.username,u.role,u.status AS account_status,u.isBanned,u.is_banned
        FROM password_reset_requests r JOIN users u ON u.id=r.user_id WHERE r.id=?`, args: [requestId] });
      const row = target.rows[0];
      if (!row || row.status !== 'PENDING' || isRoot(row) || !eligible({ ...row, status: row.account_status })) {
        return res.status(409).json({ error: 'Talep artık beklemede değil veya hesap uygun değil.' });
      }
      const now = new Date().toISOString();
      await tx.execute({ sql: `UPDATE password_reset_requests SET status=?, updated_at=?, decided_by=?, expires_at=? WHERE id=? AND status='PENDING'`,
        args: [status, now, root.id, new Date(Date.now() + 30 * 60_000).toISOString(), requestId] });
      const notifs = await tx.execute({ sql: `SELECT id,metadata FROM notifications WHERE type='PASSWORD_RESET_REQUEST' AND target_id=?`, args: [row.user_id] });
      for (const n of notifs.rows) {
        let meta: any; try { meta = JSON.parse(String(n.metadata)); } catch { continue; }
        if (meta.requestId === requestId) await tx.execute({ sql: 'UPDATE notifications SET read=1,metadata=? WHERE id=?', args: [JSON.stringify({ ...meta, status }), n.id] });
      }
      await tx.commit();
    } finally { tx.close(); }
    notifyAdmins();
    return res.json({ success: true, decision, status });
  }));

  app.post(['/api/auth/complete-password-reset','/api/auth/reset-password','/api/reset-password'], wrap(async (req, res) => {
    if (limited(req, res, 'complete', 20)) return;
    const { username, requesterKey, resetToken: token, newPassword } = req.body;
    if (!keyValid(token) || !keyValid(requesterKey) || typeof username !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return res.status(400).json({ error: 'Geçerli talep gerekli. Şifre en az 8 karakter ve en fazla 72 bayt olmalıdır.' });
    }
    const row = await owned(username, requesterKey);
    if (!row || row.status !== 'APPROVED' || row.reset_token_hash !== sha(token)) return res.status(403).json({ error: 'Talep onaylanmamış, kullanılmış veya süresi dolmuş.' });
    const password = await bcrypt.hash(newPassword, 10);
    const tx = await client.transaction('write');
    try {
      // Conditional consume and password/session changes are one transaction: only one concurrent request wins.
      const consumed = await tx.execute({ sql: `UPDATE password_reset_requests SET status='COMPLETED',updated_at=?
        WHERE id=? AND status='APPROVED' AND expires_at>? AND reset_token_hash=?
        AND EXISTS (SELECT 1 FROM users u WHERE u.id=password_reset_requests.user_id
          AND COALESCE(u.isBanned,0)=0 AND COALESCE(u.is_banned,0)=0
          AND (u.status='approved' OR u.status IS NULL) AND LOWER(TRIM(u.username))!='emirgan' AND COALESCE(UPPER(u.role),'')!='ROOT')`,
        args: [new Date().toISOString(), row.id, new Date().toISOString(), sha(token)] });
      if (consumed.rowsAffected !== 1) return res.status(403).json({ error: 'Talep artık geçerli değil.' });
      await tx.execute({ sql: 'UPDATE users SET password=?,token=NULL WHERE id=?', args: [password, row.user_id] });
      await tx.execute({ sql: 'DELETE FROM user_sessions WHERE user_id=?', args: [row.user_id] });
      await tx.commit();
    } finally { tx.close(); }
    await syncNotifications();
    invalidateUser(Number(row.user_id));
    for (const socket of io.sockets.sockets.values()) if (Number(socket.data.user?.id) === Number(row.user_id)) {
      socket.emit('session_revoked', { message: 'Şifreniz değişti. Tekrar giriş yapın.' });
      socket.disconnect(true);
    }
    notifyAdmins();
    return res.json({ success: true, message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapın.' });
  }));

  return {
    authorizeAdmin: admin,
    async interceptLogin(req: Request, res: Response, user: Row) {
      const key = req.body.requesterKey;
      const row = await owned(user.username, key);
      if (!row || !keyValid(key)) return false;
      if (row.status === 'APPROVED' || (row.status === 'PENDING' && !req.body.password)) {
        res.json(statusResponse(row, key));
        return true;
      }
      if (row.status === 'REJECTED' && !req.body.password) {
        res.status(403).json({ error: 'Şifre sıfırlama talebiniz yönetici tarafından reddedildi. Geçerli şifrenizle giriş yapın.' });
        return true;
      }
      return false;
    },
    async cancelPending(userId: number) {
      await client.execute({ sql: `UPDATE password_reset_requests SET status='CANCELLED',updated_at=? WHERE user_id=? AND status='PENDING'`, args: [new Date().toISOString(),userId] });
      await syncNotifications();
      notifyAdmins();
    }
  };
}
