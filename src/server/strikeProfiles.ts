import type { Client } from '@libsql/client';
import { cleanSkin, isSkin, SkinId } from '../games/kapsstrike/skins';
export class StrikeProfiles {
 private ready?:Promise<unknown>;
 readonly cache=new Map<number,SkinId>();
 readonly persisted=new Set<number>();
 constructor(private db?:Client){}
 private ensure(){
  if(!this.db) return Promise.resolve();
  return this.ready ||= this.db.execute('CREATE TABLE IF NOT EXISTS kapsstrike_profiles (user_id INTEGER PRIMARY KEY, skin TEXT NOT NULL DEFAULT \'classic\', updated_at INTEGER NOT NULL)').catch(e=>{this.ready=undefined;throw e;});
 }
 async get(userId:number):Promise<SkinId>{
  await this.ensure();
  if(!this.db) return this.cache.get(userId)||'classic';
  const r=await this.db.execute({sql:'SELECT skin FROM kapsstrike_profiles WHERE user_id=?',args:[userId]});
  const skin=cleanSkin(r.rows[0]?.skin);if(r.rows.length)this.persisted.add(userId);else this.persisted.delete(userId);this.cache.set(userId,skin);return skin;
 }
 async set(userId:number,value:unknown){
  if(!isSkin(value)) throw new Error('Geçersiz karakter.');
  if(!this.db) throw new Error('Hesaba kayıt bu sunucuda yapılandırılmamış.');
  await this.ensure();
  await this.db.execute({sql:'INSERT INTO kapsstrike_profiles (user_id,skin,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET skin=excluded.skin,updated_at=excluded.updated_at',args:[userId,value,Date.now()]});
  this.persisted.add(userId);this.cache.set(userId,value);return value;
 }
}
