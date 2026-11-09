import {activityUserRoom} from "./activityGames";
import type {Express,Request,Response} from 'express';
import type {Server} from 'socket.io';
import {resolveAyvalikUser} from './ayvalikAuth';
export async function initAyvalikRooms(db:any){
 await db.batch([
 `CREATE TABLE IF NOT EXISTS ayvalik_rooms(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,capacity INTEGER NOT NULL CHECK(capacity IN(2,3)),owner_id INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS ayvalik_room_members(user_id INTEGER PRIMARY KEY,room_id INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS ayvalik_room_invites(room_id INTEGER NOT NULL,sender_id INTEGER NOT NULL,target_id INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(room_id,target_id))`
 ],'write');
}
export function registerAyvalikRooms(app:Express,db:any,io?:Server){
 const wrap=(fn:(req:Request,res:Response,user:any)=>Promise<any>)=>async(req:Request,res:Response)=>{try{const user=await resolveAyvalikUser(req,db);if(!user)return res.status(401).json({success:false,error:'Oturumunuz geçersiz. Yeniden giriş yapın.'});await fn(req,res,user);}catch(e:any){res.status(400).json({success:false,error:e.message||'İşlem tamamlanamadı.'});}};
 const publish=()=>io?.emit('ayvalik:rooms_changed');
 const transaction=async(fn:(tx:any)=>Promise<any>)=>{const tx=await db.transaction('write');try{const r=await fn(tx);await tx.commit();return r;}catch(e){await tx.rollback();throw e;}finally{tx.close();}};
 app.get('/api/ayvalik/rooms',wrap(async(_req,res,user)=>{
  const rooms=await db.execute('SELECT * FROM ayvalik_rooms ORDER BY id DESC');
  const members=await db.execute('SELECT m.room_id,u.id,u.username,u.avatar FROM ayvalik_room_members m JOIN users u ON u.id=m.user_id');
  const invites=await db.execute({sql:'SELECT i.room_id,i.sender_id,u.username AS sender_name,r.name AS room_name FROM ayvalik_room_invites i JOIN users u ON u.id=i.sender_id JOIN ayvalik_rooms r ON r.id=i.room_id WHERE i.target_id=? ORDER BY i.created_at DESC',args:[user.id]});
  res.json({success:true,rooms:rooms.rows.map((r:any)=>({...r,members:members.rows.filter((m:any)=>Number(m.room_id)===Number(r.id))})),invites:invites.rows});
 }));
 app.get('/api/ayvalik/room-users',wrap(async(_req,res)=>{const users=await db.execute("SELECT id,username,avatar FROM users WHERE COALESCE(isBanned,0)=0 AND COALESCE(is_banned,0)=0 AND COALESCE(status,'approved')='approved' ORDER BY username");res.json({success:true,users:users.rows});}));
 app.post('/api/ayvalik/rooms',wrap(async(req,res,user)=>{
  const capacity=Number(req.body.capacity);if(![2,3].includes(capacity))throw Error('Odalar 2 veya 3 kişilik olabilir.');
  const name=typeof req.body.name==='string'?req.body.name.trim().slice(0,60):'';
  await transaction(async tx=>{const joined=await tx.execute({sql:'SELECT room_id FROM ayvalik_room_members WHERE user_id=?',args:[user.id]});if(joined.rows.length)throw Error('Önce mevcut odandan ayrılmalısın.');const room=await tx.execute({sql:'INSERT INTO ayvalik_rooms(name,capacity,owner_id) VALUES(?,?,?)',args:[name||`${user.username} odası`,capacity,user.id]});await tx.execute({sql:'INSERT INTO ayvalik_room_members(user_id,room_id) VALUES(?,?)',args:[user.id,Number(room.lastInsertRowid)]});});publish();res.json({success:true});
 }));
 app.post('/api/ayvalik/rooms/:id/join',wrap(async(req,res,user)=>{
  const id=Number(req.params.id);await transaction(async tx=>{const joined=await tx.execute({sql:'SELECT room_id FROM ayvalik_room_members WHERE user_id=?',args:[user.id]});if(joined.rows.length){if(Number(joined.rows[0].room_id)===id)return;throw Error('Önce mevcut odandan ayrılmalısın.');}
   const room=await tx.execute({sql:'SELECT capacity FROM ayvalik_rooms WHERE id=?',args:[id]});if(!room.rows.length)throw Error('Oda artık mevcut değil.');const count=await tx.execute({sql:'SELECT COUNT(*) AS n FROM ayvalik_room_members WHERE room_id=?',args:[id]});if(Number(count.rows[0].n)>=Number(room.rows[0].capacity))throw Error('Bu oda dolu.');await tx.execute({sql:'INSERT INTO ayvalik_room_members(user_id,room_id) VALUES(?,?)',args:[user.id,id]});await tx.execute({sql:'DELETE FROM ayvalik_room_invites WHERE target_id=?',args:[user.id]});});publish();res.json({success:true});
 }));
 app.post('/api/ayvalik/rooms/:id/leave',wrap(async(req,res,user)=>{
  const id=Number(req.params.id);await transaction(async tx=>{await tx.execute({sql:'DELETE FROM ayvalik_room_members WHERE user_id=? AND room_id=?',args:[user.id,id]});const members=await tx.execute({sql:'SELECT user_id FROM ayvalik_room_members WHERE room_id=? ORDER BY user_id',args:[id]});if(!members.rows.length){await tx.execute({sql:'DELETE FROM ayvalik_rooms WHERE id=?',args:[id]});await tx.execute({sql:'DELETE FROM ayvalik_room_invites WHERE room_id=?',args:[id]});}else await tx.execute({sql:'UPDATE ayvalik_rooms SET owner_id=? WHERE id=? AND owner_id=?',args:[members.rows[0].user_id,id,user.id]});});publish();res.json({success:true});
 }));
 app.post('/api/ayvalik/rooms/:id/invite',wrap(async(req,res,user)=>{
  const id=Number(req.params.id),target=Number(req.body.userId);if(!Number.isSafeInteger(target)||target<=0||target===Number(user.id))throw Error('Geçerli bir kişi seç.');
  await transaction(async tx=>{const room=await tx.execute({sql:'SELECT r.capacity,(SELECT COUNT(*) FROM ayvalik_room_members WHERE room_id=r.id) AS n FROM ayvalik_rooms r JOIN ayvalik_room_members m ON m.room_id=r.id WHERE r.id=? AND m.user_id=?',args:[id,user.id]});if(!room.rows.length)throw Error('Davet için bu odada olmalısın.');if(Number(room.rows[0].n)>=Number(room.rows[0].capacity))throw Error('Bu oda dolu.');const users=await tx.execute({sql:"SELECT id FROM users WHERE id=? AND COALESCE(isBanned,0)=0 AND COALESCE(is_banned,0)=0 AND COALESCE(status,'approved')='approved'",args:[target]});if(!users.rows.length)throw Error('Kullanıcı bulunamadı.');const previous=await tx.execute({sql:'SELECT created_at FROM ayvalik_room_invites WHERE room_id=? AND target_id=?',args:[id,target]});if(previous.rows.length&&Date.now()-Number(previous.rows[0].created_at)<30000)throw Error('Davet zaten gönderildi.');await tx.execute({sql:'INSERT INTO ayvalik_room_invites(room_id,sender_id,target_id,created_at) VALUES(?,?,?,?) ON CONFLICT(room_id,target_id) DO UPDATE SET sender_id=excluded.sender_id,created_at=excluded.created_at',args:[id,user.id,target,Date.now()]});});
  io?.to(activityUserRoom(target)).emit('activity:invited',{id:`ayvalik-room-${id}`,activity:'ayvalik-rooms',sender:String(user.username)});
  publish();res.json({success:true});
 }));
 app.post('/api/ayvalik/rooms/:id/dismiss',wrap(async(req,res,user)=>{await db.execute({sql:'DELETE FROM ayvalik_room_invites WHERE room_id=? AND target_id=?',args:[Number(req.params.id),user.id]});res.json({success:true});}));
}
