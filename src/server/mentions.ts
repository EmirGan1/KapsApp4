import type { Client } from '@libsql/client';
import type { Express } from 'express';
import { canMentionEveryone, containsMention, type MentionKind } from '../shared/mentions';
export async function createMentionService(db: Client, io: any, push: any) {
  await db.execute(`CREATE TABLE IF NOT EXISTS mentions(kind TEXT NOT NULL,target TEXT NOT NULL,user_id INTEGER NOT NULL,sender_id INTEGER NOT NULL,scope TEXT,seen_at TEXT,created_at TEXT NOT NULL,PRIMARY KEY(kind,target,user_id))`);
  await db.execute('CREATE INDEX IF NOT EXISTS mentions_owner ON mentions(user_id,created_at DESC)');
  const users = async () => (await db.execute('SELECT id,username,avatar FROM users WHERE COALESCE(isBanned,0)=0')).rows;
  async function audience(kind: MentionKind, scope?: string | number) {
    if (kind === 'group') { const row = (await db.execute({sql:'SELECT members FROM groups WHERE id=?',args:[String(scope)]})).rows[0]; return row ? JSON.parse(String(row.members || '[]')).map(Number) as number[] : []; }
    if (kind === 'dm') return String(scope || '').split(':').map(Number).filter(Number.isSafeInteger);
    return null;
  }
  async function record(kind: MentionKind, target: string | number, sender: number, content: string, scope?: string | number) {
    if (!content?.includes('@')) return;
    const all = await users(), author = all.find(u => Number(u.id) === sender); if (!author) return;
    const allowed = await audience(kind,scope);
    if (allowed && !allowed.includes(sender)) return;
    const broadcast = canMentionEveryone(String(author.username)) && (containsMention(content,'herkes') || containsMention(content,'everyone'));
    const recipients = all.filter(u => Number(u.id)!==sender && (!allowed || allowed.includes(Number(u.id))) && (broadcast || containsMention(content,String(u.username))));
    const now=new Date().toISOString(),metadata=JSON.stringify({kind,target:String(target),scope:scope==null?null:String(scope)});
    const text=`${author.username} seni ${kind==='post'?'bir gönderide':'bir mesajda'} etiketledi.`;
    // Atomic receipt + notification pairs, batched so @herkes doesn't block on one network roundtrip per user.
    for(let offset=0;offset<recipients.length;offset+=100){
      const chunk=recipients.slice(offset,offset+100);
      const results=await db.batch(chunk.flatMap(recipient=>{
        const userId=Number(recipient.id);
        return [{sql:"INSERT INTO notifications(user_id,type,content,read,sender_id,target_id,metadata,created_at) SELECT ?,'mention',?,0,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM mentions WHERE kind=? AND target=? AND user_id=?)",args:[userId,text,sender,Number(target),metadata,now,kind,String(target),userId]},
        {sql:'INSERT OR IGNORE INTO mentions(kind,target,user_id,sender_id,scope,created_at) VALUES(?,?,?,?,?,?)',args:[kind,String(target),userId,sender,scope==null?null:String(scope),now]}];
      }),'write');
      chunk.forEach((recipient,index)=>{
        if(!results[index*2].rowsAffected)return;
        const userId=Number(recipient.id),notification={id:Number(results[index*2].lastInsertRowid),user_id:userId,type:'mention',content:text,read:0,sender_id:sender,target_id:Number(target),metadata,created_at:now};
        io.to(`dm-user:${userId}`).emit('new_notification',notification);
        io.to(`dm-user:${userId}`).emit('mention_updated');
        void push.deliver(userId,{title:'Etiketlendin',body:text,tag:`mention-${kind}-${target}`,url:`/?mentionKind=${kind}&mentionId=${encodeURIComponent(String(target))}`,expiresAt:Date.now()+86400000}).catch(()=>{});
      });
    }
  }
  function routes(app: Express, auth: (req:any)=>Promise<any>) {
    const wrap=(fn:any)=>async(req:any,res:any)=>{try{const user=await auth(req);if(!user||Number(user.isBanned)===1)return res.sendStatus(401);await fn(req,res,user);}catch(e){console.error('Mentions:',e);res.sendStatus(500);}};
    app.get('/api/mentions/users',wrap(async(req:any,res:any,user:any)=>{
      const q=String(req.query.q||'').slice(0,60).toLocaleLowerCase('tr');
      const kind=req.query.kind as MentionKind; const allowed=await audience(kind,req.query.scope);
      if(allowed&&!allowed.includes(Number(user.id)))return res.sendStatus(403);
      res.json({everyone:canMentionEveryone(String(user.username)),users:(await users()).filter(u=>(!allowed||allowed.includes(Number(u.id)))&&String(u.username).toLocaleLowerCase('tr').includes(q)).slice(0,30).map(u=>({id:Number(u.id),username:u.username,avatar:u.avatar}))});
    }));
    app.get('/api/mentions/state',wrap(async(_q:any,res:any,user:any)=>res.json((await db.execute({sql:'SELECT kind,target,seen_at FROM mentions WHERE user_id=? ORDER BY created_at DESC LIMIT 2000',args:[Number(user.id)]})).rows)));
    app.post('/api/mentions/seen',wrap(async(req:any,res:any,user:any)=>{
      const {kind,target}=req.body||{};
      await db.execute({sql:'UPDATE mentions SET seen_at=COALESCE(seen_at,?) WHERE kind=? AND target=? AND user_id=?',args:[new Date().toISOString(),String(kind),String(target),Number(user.id)]});
      io.to(`dm-user:${Number(user.id)}`).emit('mention_updated');res.json({ok:true});
    }));
    app.get('/api/mentions/open/:kind/:target',wrap(async(req:any,res:any,user:any)=>{
      const {kind,target}=req.params;
      const receipt=(await db.execute({sql:'SELECT scope FROM mentions WHERE kind=? AND target=? AND user_id=?',args:[kind,target,Number(user.id)]})).rows[0];
      if(!receipt)return res.sendStatus(404);
      const allowed=await audience(kind,receipt.scope as string);if(allowed&&!allowed.includes(Number(user.id)))return res.sendStatus(403);
      const table=({global:'global_messages',group:'group_messages',dm:'messages',post:'posts'} as any)[kind];if(!table)return res.sendStatus(400);
      const row=(await db.execute({sql:`SELECT t.${kind==='post'?'caption':'content'} AS content,u.username FROM ${table} t JOIN users u ON u.id=t.${kind==='post'?'user_id':'sender'} WHERE t.id=?`,args:[target]})).rows[0];
      if(!row)return res.sendStatus(404);res.json({...row,kind,target});
    }));
  }
  return {record,routes};
}
