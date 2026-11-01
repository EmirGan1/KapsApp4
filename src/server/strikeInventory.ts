import {caseCost,CREDIT_REWARDS,MAX_CREDITS} from '../games/kapsstrike/economy';
import type {Client} from '@libsql/client';
import {randomInt} from 'node:crypto';
import {emptyInventory,rollCase,cosmetic,COSMETICS,type Inventory} from '../games/kapsstrike/cosmetics';

/** Per-account serialization covers every socket; database writes finish before rewards are acknowledged. */
export class StrikeInventory {
 readonly cache = new Map<number, Inventory>();
 private ready?: Promise<unknown>;
 private locks = new Map<number, Promise<unknown>>();

 constructor(private db?: Client) {}
 get persistent(){return !!this.db;}
 private normalize(state:Inventory){state.credits=Number.isSafeInteger(state.credits)&&state.credits!>=0?Math.min(MAX_CREDITS,state.credits!):0;state.freeCases||={};return state;}

 private async ensure() {
  if (!this.db) throw new Error('Envanter veritabanı yapılandırılmamış.');
  await (this.ready ||= this.db.batch([
   'CREATE TABLE IF NOT EXISTS kapsstrike_inventory (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
   'CREATE TABLE IF NOT EXISTS kapsstrike_credit_rewards (user_id INTEGER NOT NULL,event_id TEXT NOT NULL,amount INTEGER NOT NULL,PRIMARY KEY(user_id,event_id))'
  ],'write').catch(e => {
   this.ready = undefined;
   throw e;
  }));
 }

 async isAuthorizedAdmin(userId: number, username?: string): Promise<boolean> {
  const normalized = String(username || '').trim().toLowerCase();
  if (normalized !== 'emirgan' || !Number.isSafeInteger(userId) || userId <= 0) return false;
  if (!this.db) return true;
  try {
   await this.ensure();
   const r = await this.db.execute({
    sql: "SELECT id, username FROM users WHERE id = ? AND LOWER(TRIM(username)) = 'emirgan' LIMIT 1",
    args: [userId],
   });
   return r.rows.length > 0;
  } catch (err) {
   console.error('[StrikeInventory] Admin verification error:', err);
   return normalized === 'emirgan';
  }
 }

 async get(id: number): Promise<Inventory> {
  await this.ensure();
  const r = await this.db!.execute({
   sql: 'SELECT data FROM kapsstrike_inventory WHERE user_id=?',
   args: [id],
  });
  const state = this.normalize(r.rows.length ? JSON.parse(String(r.rows[0].data)) : emptyInventory());
  this.cache.set(id, state);
  return state;
 }

 async grantItem(targetId: number, itemId: string, adminId?: number, adminName?: string) {
  const item = cosmetic(itemId);
  if (!item) throw new Error(`Geçersiz skin kimliği: ${itemId}`);
  return this.run(targetId, () =>
   this.mutate(targetId, state => {
    state.owned[item.id] = (state.owned[item.id] || 0) + 1;
    console.info(
     `[StrikeAdminAudit] Skin Granted: '${item.id}' (${item.name}) to user #${targetId} by ${adminName || 'system'}(#${adminId || 0}) at ${new Date().toISOString()}`
    );
    return { state, item };
   })
  );
 }

 async grantBatch(targetId: number, itemIds: string[], adminId?: number, adminName?: string) {
  if (!Array.isArray(itemIds) || !itemIds.length) throw new Error('En az bir skin seçilmelidir.');
  const validated = itemIds.map(id => {
   const c = cosmetic(id);
   if (!c) throw new Error(`Geçersiz skin: ${id}`);
   return c;
  });
  return this.run(targetId, () =>
   this.mutate(targetId, state => {
    for (const item of validated) {
     state.owned[item.id] = (state.owned[item.id] || 0) + 1;
    }
    console.info(
     `[StrikeAdminAudit] Batch Skins Granted (${validated.length} items) to user #${targetId} by ${adminName || 'system'}(#${adminId || 0})`
    );
    return { state, count: validated.length };
   })
  );
 }

 async revokeItem(targetId: number, itemId: string, adminId?: number, adminName?: string) {
  const item = cosmetic(itemId);
  if (!item) throw new Error(`Geçersiz skin kimliği: ${itemId}`);
  return this.run(targetId, () =>
   this.mutate(targetId, state => {
    if (!state.owned[item.id]) {
     throw new Error('Kullanıcı bu skine sahip değil.');
    }
    delete state.owned[item.id];
    if (state.equipped[item.weapon] === item.id) {
     delete state.equipped[item.weapon];
    }
    console.info(
     `[StrikeAdminAudit] Skin Revoked: '${item.id}' from user #${targetId} by ${adminName || 'system'}(#${adminId || 0})`
    );
    return { state, item };
   })
  );
 }

 async grantAll(id: number) {
  return this.run(id, () =>
   this.mutate(id, state => {
    for (const item of COSMETICS) state.owned[item.id] = Math.max(1, state.owned[item.id] || 0);
    return state;
   })
  );
 }

 async revokeAll(id: number, adminId?: number, adminName?: string) {
  return this.run(id, () =>
   this.mutate(id, state => {
    state.owned = {};
    state.equipped = {};
    console.info(
     `[StrikeAdminAudit] All Skins Revoked from user #${id} by ${adminName || 'system'}(#${adminId || 0})`
    );
    return state;
   })
  );
 }

 async searchUsers(query: string) {
  await this.ensure();
  const q = query.trim().slice(0, 40);
  const sql = q
   ? "SELECT id,username FROM users WHERE LOWER(username) LIKE LOWER(?) ORDER BY CASE WHEN LOWER(username)='emirgan' THEN 0 ELSE 1 END, username LIMIT 50"
   : "SELECT id,username FROM users ORDER BY CASE WHEN LOWER(username)='emirgan' THEN 0 ELSE 1 END, username LIMIT 50";
  const args = q ? [`%${q.replace(/[\\%_]/g, '\\$&')}%`] : [];
  const r = await this.db!.execute({ sql, args });
  return r.rows.map(u => ({ id: Number(u.id), username: String(u.username) }));
 }

 async getUser(id: number) {
  await this.ensure();
  const r = await this.db!.execute({
   sql: 'SELECT id,username FROM users WHERE id=? LIMIT 1',
   args: [id],
  });
  const u = r.rows[0];
  return u ? { id: Number(u.id), username: String(u.username) } : null;
 }

 private run<T>(id: number, fn: () => Promise<T>): Promise<T> {
  const prev = this.locks.get(id) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  this.locks.set(id, next);
  void next.finally(() => {
   if (this.locks.get(id) === next) this.locks.delete(id);
  }).catch(() => {});
  return next;
 }

 private async mutate<T>(id: number, fn: (state: Inventory, updated: number, tx:Awaited<ReturnType<Client['transaction']>>) => T|Promise<T>) {
  await this.ensure();
  const tx = await this.db!.transaction('write');
  try {
   const row = await tx.execute({
    sql: 'SELECT data,updated_at FROM kapsstrike_inventory WHERE user_id=?',
    args: [id],
   });
   const state: Inventory = this.normalize(row.rows.length ? JSON.parse(String(row.rows[0].data)) : emptyInventory());
   const result = await fn(state, Number(row.rows[0]?.updated_at || 0),tx);
   await tx.execute({
    sql: 'INSERT INTO kapsstrike_inventory(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',
    args: [id, JSON.stringify(state), Date.now()],
   });
   await tx.commit();
   this.cache.set(id, state);
   return result;
  } catch (e) {
   await tx.rollback();
   throw e;
  } finally {
   tx.close();
  }
 }

 /** Called exclusively by authoritative kill/round events, never by client RPC. */
 reward(id:number,eventId:string,reason:keyof typeof CREDIT_REWARDS){
  if(!Number.isSafeInteger(id)||id<=0||!eventId||eventId.length>180||!Object.hasOwn(CREDIT_REWARDS,reason))return Promise.reject(new Error('Geçersiz ödül.'));
  return this.run(id,()=>this.mutate(id,async(state,_updated,tx)=>{
   const amount=CREDIT_REWARDS[reason];
   const r=await tx.execute({sql:'INSERT OR IGNORE INTO kapsstrike_credit_rewards(user_id,event_id,amount) VALUES(?,?,?)',args:[id,eventId,amount]});
   if(r.rowsAffected)state.credits=Math.min(MAX_CREDITS,(state.credits||0)+amount);
   return state;
  }));
 }
 adjustCredits(id:number,amount:number,mode:'add'|'set',adminId:number){
  if(!Number.isSafeInteger(amount)||Math.abs(amount)>MAX_CREDITS||!['add','set'].includes(mode))return Promise.reject(new Error('Geçersiz kredi miktarı.'));
  return this.run(id,()=>this.mutate(id,state=>{
   const next=mode==='set'?amount:(state.credits||0)+amount;
   if(next<0||next>MAX_CREDITS)throw new Error('Bakiye 0–10.000.000 aralığında olmalı.');
   console.info(`[StrikeAdminAudit] Credits user #${id}: ${state.credits} -> ${next}; admin #${adminId}`);state.credits=next;return state;
  }));
 }
 open(id: number, caseId: string) {
  return this.run(id, () =>
   this.mutate(id, (state, _updated) => {
    if (Date.now() - (state.lastOpenedAt || 0) < 2500) throw new Error('Yeni kasa için biraz bekle.');
    const cost=caseCost(caseId,state.freeCases);
    if((state.credits||0)<cost)throw new Error(`Yetersiz kredi. Bu kasa ${cost} Kredi.`);
    const item = rollCase(caseId, randomInt(0, 1000000000) / 1000000000);
    state.credits=(state.credits||0)-cost;state.freeCases![caseId]=true;
    state.owned[item.id] = (state.owned[item.id] || 0) + 1;
    state.opened++;
    state.lastOpenedAt = Date.now();
    return { state, item };
   })
  );
 }

 equip(id: number, itemId: string) {
  return this.run(id, () =>
   this.mutate(id, state => {
    const item = cosmetic(itemId);
    if (!item || !state.owned[item.id]) throw new Error('Bu görünüm envanterinde yok.');
    state.equipped[item.weapon] = item.id;
    return state;
   })
  );
 }
}
