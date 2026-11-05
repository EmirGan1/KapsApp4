import type {Request} from 'express';
/** Resolve authenticated accounts across current and multi-device sessions. */
export async function resolveAyvalikUser(req:Request,client:any){
 const token=req.headers.authorization?.replace(/^Bearer\s+/i,'')||req.query.token||req.body?.token;
 if(typeof token!=='string'||!token.trim())return null;
 const result=await client.execute({sql:`SELECT u.id,u.username,u.avatar,u.color,u.roles,u.is_admin FROM users u
 WHERE (u.token=? OR EXISTS(SELECT 1 FROM user_sessions s WHERE s.user_id=u.id AND s.token=? AND (s.expires_at IS NULL OR s.expires_at>?)))
 AND COALESCE(u.isBanned,0)=0 AND COALESCE(u.is_banned,0)=0 AND COALESCE(u.status,'approved')='approved'`,args:[token,token,new Date().toISOString()]});
 return result.rows[0]||null;
}
