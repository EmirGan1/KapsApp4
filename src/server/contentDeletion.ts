import type { Client } from '@libsql/client';
import type { Express } from 'express';
import { positiveId } from '../shared/socialNavigation';
import type { MessageRamCache } from './messageRamCache';
type MessageKind='private'|'global'|'group';
const tables={private:'messages',global:'global_messages',group:'group_messages'} as const;
export class DeletionError extends Error { constructor(public status:number,message:string){super(message);} }
export async function createContentDeletion(db:Client,io:any,cache:MessageRamCache,removeFile:(url:string)=>Promise<any>) {
  const tableNames=new Set((await db.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r=>String(r.name)));
  const notificationColumns=tableNames.has('notifications')?new Set((await db.execute('PRAGMA table_info(notifications)')).rows.map(r=>String(r.name))):new Set<string>();
  async function mutate(kind:MessageKind|'post'|'comment',rawId:unknown,actorId:number){
    const id=positiveId(rawId);if(!id)throw new DeletionError(400,'İçerik henüz kaydedilmemiş veya kimliği geçersiz. Sayfayı yenileyip tekrar dene.');
    const table=kind==='post'?'posts':kind==='comment'?'comments':tables[kind];if(!table)throw new DeletionError(400,'Sohbet türü gerekli. Sayfayı yenileyin.');
    const tx=await db.transaction('write');let row:any=null;
    try {
      const actor=(await tx.execute({sql:'SELECT * FROM users WHERE id=?',args:[actorId]})).rows[0];
      if(!actor||Number(actor.isBanned)===1||Number(actor.is_banned)===1)throw new DeletionError(401,'Oturum gerekli.');
      const admin=String(actor.username||'').trim().toLowerCase()==='emirgan'||Number(actor.is_admin)===1||['ROOT','ADMIN'].includes(String(actor.role||'').toUpperCase());
      row=(await tx.execute({sql:`SELECT * FROM ${table} WHERE id=?`,args:[id]})).rows[0];
      if(!row){await tx.commit();if(kind==='global'||kind==='group')cache.clear();return {success:true,alreadyDeleted:true,id,type:kind};}
      const owner=Number(kind==='post'||kind==='comment'?row.user_id:row.sender);
      if(owner!==actorId&&!admin)throw new DeletionError(403,'Bu içeriği yalnızca gönderen kişi veya yönetici silebilir.');
      if(kind==='post'){
        await tx.execute({sql:'DELETE FROM likes WHERE post_id=?',args:[id]});
        await tx.execute({sql:'DELETE FROM comments WHERE post_id=?',args:[id]});
      } else if(kind!=='comment') await tx.execute({sql:`UPDATE ${table} SET reply_to=NULL WHERE reply_to=?`,args:[id]});
      await tx.execute({sql:`DELETE FROM ${table} WHERE id=?`,args:[id]});
      const mentionKind=kind==='private'?'dm':kind;
      if(tableNames.has('mentions'))await tx.execute({sql:'DELETE FROM mentions WHERE kind=? AND target=?',args:[mentionKind,String(id)]});
      if(notificationColumns.has('target_id')){
        if(kind==='post')await tx.execute({sql:"DELETE FROM notifications WHERE target_id=? AND type IN ('like','comment')",args:[id]});
        if(notificationColumns.has('metadata'))await tx.execute({sql:"DELETE FROM notifications WHERE type='mention' AND target_id=? AND json_valid(metadata) AND json_extract(metadata,'$.kind')=?",args:[id,mentionKind]});
      }
      await tx.commit();
    }catch(error){await tx.rollback();throw error;}finally{tx.close();}
    if(kind==='private'||kind==='group'||kind==='global'){
      if(kind==='global')cache.clear('global');if(kind==='group')cache.clear(`group_${row.group_id}`);
      const payload={id,_id:id,message_id:id,messageId:id,type:kind,table,group_id:row.group_id,receiver:row.receiver,sender:row.sender};
      const delivery=kind==='private'?io.to(`dm-user:${Number(row.sender)}`).to(`dm-user:${Number(row.receiver)}`):io;
      delivery.emit('message_deleted',payload);delivery.emit('message:deleted',payload);
    }else if(kind==='post'){
      io.emit('post_deleted',{id,_id:id,postId:id});io.emit('post:deleted',{id,_id:id,postId:id});io.emit('feed_updated');
    }else{io.emit('comment_deleted',{id,commentId:id,postId:Number(row.post_id)});io.emit('comment:deleted',{id,commentId:id,postId:Number(row.post_id)});io.emit('comments_updated',Number(row.post_id));io.emit('feed_updated');}
    // The database commit and cache invalidation happen before slow/best-effort file cleanup.
    const urls=new Set<string>();
    if(kind==='post'){
      if(typeof row.image==='string')urls.add(row.image);
      try{const list=typeof row.attachments==='string'?JSON.parse(row.attachments):row.attachments;for(const a of Array.isArray(list)?list:[]){const url=typeof a==='string'?a:a?.url;if(typeof url==='string')urls.add(url);}}catch{}
    }else if(kind!=='comment'&&row.type!=='text'&&typeof row.content==='string')urls.add(row.content);
    for(const url of urls)if(url.startsWith('/uploads/'))void removeFile(url).catch(console.error);
    return {success:true,id,_id:id,postId:kind==='post'?id:Number(row.post_id)||undefined,commentId:kind==='comment'?id:undefined,message_id:kind in tables?id:undefined,messageId:kind in tables?id:undefined,type:kind};
  }
  const fail=(error:any)=>({error:error instanceof DeletionError?error.message:'Silme işlemi tamamlanamadı. Lütfen tekrar deneyin.'});
  function routes(app:Express,auth:(req:any)=>Promise<any>){
    for(const [path,kind] of [['/api/messages/:id',null],['/api/posts/:id','post'],['/api/comments/:id','comment']] as const){
      app.delete(path,async(req,res)=>{try{const user=await auth(req);if(!user)return res.sendStatus(401);const type=kind||req.query.type;if(!['private','global','group','post','comment'].includes(String(type))||(!kind&&!Object.hasOwn(tables,String(type))))return res.status(400).json({error:'Sohbet türü gerekli. Sayfayı yenileyin.'});res.json(await mutate(type as any,req.params.id,Number(user.id)));}catch(error){res.status(error instanceof DeletionError?error.status:500).json(fail(error));}});
    }
  }
  function sockets(socket:any,user:any){
    const handle=async(kind:any,id:any,cb:any)=>{try{if(!['private','global','group','post','comment'].includes(String(kind)))throw new DeletionError(400,'Sohbet türü gerekli.');const result=await mutate(kind,id,Number(user.id));if(typeof cb==='function')cb(result);}catch(error){if(typeof cb==='function')cb(fail(error));}};
    socket.on('delete_message',(data:any,cb:any)=>handle(data?.type,data?.message_id??data?.id??data?.messageId,cb));
    socket.on('delete_global_message',(data:any,cb:any)=>handle('global',typeof data==='object'?data?.message_id??data?.id:data,cb));
    socket.on('delete_post',(data:any,cb:any)=>handle('post',typeof data==='object'?data?.postId??data?.id:data,cb));
    socket.on('delete_comment',(data:any,cb:any)=>handle('comment',typeof data==='object'?data?.commentId??data?.id:data,cb));
  }
  return {mutate,routes,sockets};
}
