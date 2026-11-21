import type { Client } from '@libsql/client';
import type { Router, Response } from 'express';

export async function initPreparationSchema(db: Client) {
  await db.execute(`CREATE TABLE IF NOT EXISTS german_preparations (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL,
    stage TEXT NOT NULL, percent INTEGER NOT NULL, status TEXT NOT NULL,
    estimate_ms INTEGER NOT NULL, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, finished_at INTEGER
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS german_preparations_owner ON german_preparations(user_id, started_at)');
}

export function registerPreparationProgress(router: Router, db: Client) {
  router.get('/preparations/:id', async (req, res) => {
    try {
      const row = (await db.execute({ sql: 'SELECT stage,percent,status,estimate_ms,started_at,updated_at FROM german_preparations WHERE id=? AND user_id=?', args: [String(req.params.id), res.locals.germanUser] })).rows[0];
      if (!row) return void res.sendStatus(404);
      const elapsedMs = Date.now() - Number(row.started_at);
      res.json({ stage: row.stage, percent: row.percent, status: row.status,
        estimateMs: Number(row.estimate_ms), elapsedMs, remainingMs: Math.max(0, Number(row.estimate_ms) - elapsedMs) });
    } catch { res.status(503).json({ error: 'Hazırlık durumu alınamadı.' }); }
  });
  router.use(async (req, res, next) => {
    if (req.method !== 'POST' || !(/^\/sessions$|^\/sessions\/[^/]+\/reinforce$|^\/ai\/reinforcement$/.test(req.path))) return next();
    const id = req.get('X-German-Preparation-Id');
    if (!id) return next();
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) return void res.status(400).json({ error: 'Geçersiz hazırlık kimliği.' });
    const user = res.locals.germanUser;
    const kind = req.path === '/ai/reinforcement' ? 'ai' : 'standard';
    try {
      const estimate = (await db.execute({ sql: `SELECT AVG(duration) AS estimate FROM (SELECT finished_at-started_at AS duration FROM german_preparations WHERE user_id=? AND kind=? AND status='done' ORDER BY started_at DESC LIMIT 10)`, args: [user, kind] })).rows[0]?.estimate;
      const now = Date.now();
      const saved = await db.execute({ sql: `INSERT OR IGNORE INTO german_preparations VALUES(?,?,?,'accepted',10,'working',?,?,?,NULL)`, args: [id, user, kind, Math.min(120000, Math.max(1000, Number(estimate) || (kind === 'ai' ? 40000 : 6000))), now, now] });
      if (!saved.rowsAffected) return void res.status(409).json({ error: 'Bu hazırlık isteği zaten işlendi. Mevcut oturumlarını kontrol et.' });
      res.locals.germanPreparationId = id;
      // Persisted status works across PM2 workers; keep the progress table bounded.
      void db.execute({ sql: 'DELETE FROM german_preparations WHERE started_at < ?', args: [now - 86400000] }).catch(() => {});
      res.on('finish', () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        void db.execute({ sql: 'UPDATE german_preparations SET stage=?,percent=?,status=?,updated_at=?,finished_at=? WHERE id=? AND user_id=?',
          args: [success ? 'ready' : 'failed', success ? 100 : 0, success ? 'done' : 'failed', Date.now(), Date.now(), id, user] }).catch(() => {});
      });
      next();
    } catch (error) { next(error); }
  });
}

export async function preparationStep(db: Client, res: Response, stage: string, percent: number) {
  const id = res.locals.germanPreparationId;
  if (!id) return;
  await db.execute({ sql: `UPDATE german_preparations SET stage=?,percent=MAX(percent,?),estimate_ms=CASE WHEN ?='generating_ai' THEN MAX(estimate_ms,35000) ELSE estimate_ms END,updated_at=? WHERE id=? AND user_id=? AND status=?`,
    args: [stage, Math.min(95, percent), stage, Date.now(), id, res.locals.germanUser, 'working'] });
}
