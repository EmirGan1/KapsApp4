import type {Client} from '@libsql/client';
import {randomInt} from 'node:crypto';
import {emptyInventory,rollCase,cosmetic,COSMETICS,type Inventory} from '../games/kapsstrike/cosmetics';
/** Per-account serialization covers every socket; database writes finish before rewards are acknowledged. */
export class StrikeInventory {
 readonly cache=new Map<number,Inventory>();
 private ready?:Promise<unknown>;private locks=new Map<number,Promise<unknown>>();
 constructor(private db?:Client){}
 private async ensure(){if(!this.db)throw new Error('Envanter veritabanı yapılandırılmamış.');await(this.ready ||= this.db.execute('CREATE TABLE IF NOT EXISTS kapsstrike_inventory (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)').catch(e=>{this.ready=undefined;throw e;}));}
 async get(id:number):Promise<Inventory>{await this.ensure();const r=await this.db!.execute({sql:'SELECT data FROM kapsstrike_inventory WHERE user_id=?',args:[id]});const state=r.rows.length?JSON.parse(String(r.rows[0].data)):emptyInventory();this.cache.set(id,state);return state;}
 async grantAll(id:number){return this.run(id,()=>this.mutate(id,state=>{for(const item of COSMETICS)state.owned[item.id]=Math.max(1,state.owned[item.id]||0);return state;}));}
 async searchUsers(query:string){await this.ensure();const q=query.trim().slice(0,40);const r=await this.db!.execute({sql:"SELECT id,username FROM users WHERE LOWER(username) LIKE LOWER(?) ORDER BY CASE WHEN LOWER(username)='emirgan' THEN 0 ELSE 1 END, username LIMIT 25",args:[`%${q.replace(/[\\%_]/g,'\\$&')}%`]});return r.rows.map(u=>({id:Number(u.id),username:String(u.username)}));}
 async getUser(id:number){await this.ensure();const r=await this.db!.execute({sql:'SELECT id,username FROM users WHERE id=? LIMIT 1',args:[id]});const u=r.rows[0];return u?{id:Number(u.id),username:String(u.username)}:null;}
 private run<T>(id:number,fn:()=>Promise<T>):Promise<T>{const prev=this.locks.get(id)||Promise.resolve();const next=prev.catch(()=>{}).then(fn);this.locks.set(id,next);void next.finally(()=>{if(this.locks.get(id)===next)this.locks.delete(id);}).catch(()=>{});return next;}
 private async mutate<T>(id:number,fn:(state:Inventory,updated:number)=>T){
  await this.ensure();const tx=await this.db!.transaction('write');
  try{const row=await tx.execute({sql:'SELECT data,updated_at FROM kapsstrike_inventory WHERE user_id=?',args:[id]});const state:Inventory=row.rows.length?JSON.parse(String(row.rows[0].data)):emptyInventory();const result=fn(state,Number(row.rows[0]?.updated_at||0));await tx.execute({sql:'INSERT INTO kapsstrike_inventory(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',args:[id,JSON.stringify(state),Date.now()]});await tx.commit();this.cache.set(id,state);return result;}catch(e){await tx.rollback();throw e;}finally{tx.close();}
 }
 open(id:number,caseId:string){return this.run(id,()=>this.mutate(id,(state,updated)=>{if(Date.now()-(state.lastOpenedAt||0)<2500)throw new Error('Yeni kasa için biraz bekle.');const item=rollCase(caseId,randomInt(0,1000000000)/1000000000);state.owned[item.id]=(state.owned[item.id]||0)+1;state.opened++;state.lastOpenedAt=Date.now();return {state,item};}));}
 equip(id:number,itemId:string){return this.run(id,()=>this.mutate(id,state=>{const item=cosmetic(itemId);if(!item||!state.owned[item.id])throw new Error('Bu görünüm envanterinde yok.');state.equipped[item.weapon]=item.id;return state;}));}
}
