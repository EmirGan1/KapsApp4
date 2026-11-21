import type { Client } from '@libsql/client';
import type { Server, Socket } from 'socket.io';

export class DmPresence {
  private sessions = new Map<string, { user: number; partner: number; until: number }>();
  enter(socket: string, user: number, partner: number) {
    if (Number.isSafeInteger(partner) && partner > 0 && partner !== user)
      this.sessions.set(socket, { user, partner, until: Date.now() + 45_000 });
  }
  leave(socket: string) { this.sessions.delete(socket); }
  viewing(user: number, partner: number, socket?: string) {
    return [...this.sessions.entries()].some(([id, s]) => (!socket || id === socket) && s.user === user && s.partner === partner && s.until > Date.now());
  }
}
export const dmRoom = (a: number, b: number) => `dm_${Math.min(a, b)}_${Math.max(a, b)}`;
export function changeReaction(previous: any[], user: number, emoji: string) {
  const selected = previous.some(r => Number(r.user_id) === user && r.emoji === emoji);
  const others = previous.filter(r => Number(r.user_id) !== user);
  return selected ? others : [...others, { user_id: user, emoji }];
}
export function validEmoji(emoji: unknown): emoji is string {
  return typeof emoji === 'string' && emoji.length <= 64 &&
    /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)$/u.test(emoji);
}
const reactionLocks = new Map<number, Promise<unknown>>();
export function registerDirectMessages({ io, socket, db, presence, getUser, notify, push, mention }: {
  io: Server; socket: Socket; db: Client; presence: DmPresence;
  getUser: (id: number) => Promise<any>; notify: (...args: any[]) => Promise<any>; push: any; mention?: (...args:any[])=>Promise<void>;
}) {
  const me = Number(socket.data.user.id);
  const userRoom = (id: number) => `dm-user:${id}`;
  socket.join(userRoom(me));
  const pair = '( (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) )';
  const pairArgs = (partner: number) => [me, partner, partner, me];
  const safe = (handler: (...args: any[]) => Promise<void>) => (...args: any[]) => {
    void handler(...args).catch(error => {
      console.error('DM operation failed', error);
      const cb = args.at(-1);
      if (typeof cb === 'function') cb({ error: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' });
    });
  };
  async function populate(row: any) {
    const sender = await getUser(Number(row.sender));
    let reply = null;
    if (row.reply_to) {
      const ref = await db.execute({ sql: `SELECT * FROM messages WHERE id=? AND ${pair}`, args: [row.reply_to, row.sender, row.receiver, row.receiver, row.sender] });
      if (ref.rows[0]) reply = { ...ref.rows[0], sender_name: (await getUser(Number(ref.rows[0].sender)))?.username };
    }
    return { ...row, reactions: JSON.parse(String(row.reactions || '[]')), sender_name: sender?.username, sender_avatar: sender?.avatar, sender_color: sender?.color, reply_message: reply };
  }
  socket.on('dm:enter_chat', (data) => presence.enter(socket.id, me, Number(data?.partnerId)));
  socket.on('dm:leave_chat', () => presence.leave(socket.id));
  socket.on('disconnect', () => presence.leave(socket.id));
  socket.on('get_messages', safe(async (data, cb) => {
    const partner = Number(typeof data === 'object' ? data.friendId : data);
    if (!Number.isSafeInteger(partner) || partner <= 0) return cb([]);
    const limit = Math.max(1, Math.min(100, Number(data?.limit) || 50));
    const before = Number(data?.beforeId);
    const result = await db.execute({ sql: `SELECT * FROM messages WHERE ${pair} ${before > 0 ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`, args: [...pairArgs(partner), ...(before > 0 ? [before] : []), limit] });
    cb(await Promise.all([...result.rows].reverse().map(populate)));
  }));
  socket.on('dm:original', safe(async (data, cb) => {
    const result = await db.execute({ sql: `SELECT * FROM messages WHERE id=? AND ${pair}`, args: [Number(data.id), ...pairArgs(Number(data.partnerId))] });
    cb(result.rows[0] ? await populate(result.rows[0]) : { error: 'Mesaj artık mevcut değil.' });
  }));
  async function receipt(data: any, read: boolean) {
    const partner = Number(data?.partnerId);
    if (read && !presence.viewing(me, partner, socket.id)) return;
    const ids = [...new Set((Array.isArray(data?.messageIds) ? data.messageIds : []).map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0))].slice(0, 100) as number[];
    if (!ids.length) return;
    const now = new Date().toISOString();
    const owned = await db.execute({ sql: `SELECT id FROM messages WHERE sender=? AND receiver=? AND id IN (${ids.map(() => '?').join(',')})`, args: [partner, me, ...ids] });
    const accepted = owned.rows.map(r => Number(r.id));
    if (!accepted.length) return;
    await db.execute({ sql: `UPDATE messages SET ${read ? "status='read', is_read=1, read_at=COALESCE(read_at, ?)" : "status=CASE WHEN status='read' OR is_read=1 THEN 'read' ELSE 'delivered' END"} WHERE sender=? AND receiver=? AND id IN (${accepted.map(() => '?').join(',')})`, args: [...(read ? [now] : []), partner, me, ...accepted] });
    const payload = { chatId: dmRoom(me, partner), readerId: me, messageIds: accepted, status: read ? 'read' : 'delivered', readAt: read ? now : undefined };
    io.to(userRoom(partner)).to(userRoom(me)).emit('dm:receipt', payload);
    if (read) {
      await db.execute({ sql: "UPDATE notifications SET read=1 WHERE user_id=? AND sender_id=? AND type IN ('new_message','dm')", args: [me, partner] });
      io.to(userRoom(me)).emit('notifications_updated');
      io.to(userRoom(me)).emit('friends_updated');
    }
  }
  socket.on('dm:delivered', safe(data => receipt(data, false)));
  socket.on('dm:mark_read', safe(data => receipt(data, true)));
  socket.on('send_message', safe(async (data, cb) => {
    const partner = Number(data?.receiver);
    if (!Number.isSafeInteger(partner) || partner <= 0 || partner === me || !(await getUser(partner))) throw new Error('Invalid recipient');
    if (!['text', 'image', 'video', 'voice', 'file'].includes(data.type) || typeof data.content !== 'string' || !data.content.trim()) throw new Error('Invalid message');
    const replyId = data.reply_to == null ? null : Number(data.reply_to);
    if (replyId !== null) {
      if (!Number.isSafeInteger(replyId)) throw new Error('Reply is not persisted');
      const reference = await db.execute({ sql: `SELECT id FROM messages WHERE id=? AND ${pair}`, args: [replyId, ...pairArgs(partner)] });
      if (!reference.rows.length) throw new Error('Reply is outside conversation');
    }
    const now = new Date().toISOString();
    const saved = await db.execute({ sql: "INSERT INTO messages (sender,receiver,type,content,reply_to,reactions,file_name,file_size,room_id,status,is_read,created_at) VALUES (?,?,?,?,?,'[]',?,?,?,'sent',0,?)", args: [me, partner, data.type, data.content.trim().slice(0, data.type === 'text' ? 1000 : 4096), replyId, data.file_name || null, data.file_size || null, dmRoom(me, partner), now] });
    const row = (await db.execute({ sql: 'SELECT * FROM messages WHERE id=?', args: [Number(saved.lastInsertRowid)] })).rows[0];
    const message = { ...await populate(row), client_id: data.client_id };
    io.to(userRoom(me)).to(userRoom(partner)).emit('new_message', message);
    if (typeof cb === 'function') cb({ success: true, message });
    if (data.type === "text") await mention?.("dm",message.id,me,message.content,`${me}:${partner}`).catch(console.error);
    if (!presence.viewing(partner, me)) {
      const sender = await getUser(me);
      const preview = data.type === 'text' ? message.content.slice(0, 120) : `📎 ${data.file_name || data.type}`;
      await Promise.allSettled([
        push.deliver(partner, { title: sender.username, body: preview, avatar: typeof sender.avatar === 'string' && sender.avatar.length <= 250 ? sender.avatar : undefined, tag: `dm-${me}`, recipientId: partner, url: `/?pushDm=${me}`, expiresAt: Date.now() + 3600_000 }),
        notify(partner, 'new_message', `${sender.username}: ${preview}`, me),
      ]);
    }
  }));
  socket.on('react_message', (data, cb) => {
    if (data?.type !== 'private') return;
    const id = Number(data.message_id);
    if (!Number.isSafeInteger(id) || !validEmoji(data.emoji)) return;
    const previous = reactionLocks.get(id) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const result = await db.execute({ sql: 'SELECT * FROM messages WHERE id=? AND (sender=? OR receiver=?)', args: [id, me, me] });
      const row = result.rows[0];
      if (!row) { if (typeof cb === 'function') cb({ error: 'Mesaja erişiminiz yok.' }); return; }
      // Compare-and-swap protects concurrent processes as well as sockets.
      for (let attempt = 0; attempt < 8; attempt++) {
        const raw = String(row.reactions || '[]');
        const reactions = changeReaction(JSON.parse(raw), me, data.emoji);
        const updated = await db.execute({ sql: "UPDATE messages SET reactions=? WHERE id=? AND COALESCE(reactions,'[]')=?", args: [JSON.stringify(reactions), id, raw] });
        if (updated.rowsAffected) {
          io.to(userRoom(Number(row.sender))).to(userRoom(Number(row.receiver))).emit('message_reacted', { type: 'private', message_id: id, reactions });
          if (typeof cb === 'function') cb({ success: true });
          return;
        }
        const fresh = await db.execute({ sql: 'SELECT reactions FROM messages WHERE id=?', args: [id] });
        if (!fresh.rows[0]) return;
        row.reactions = fresh.rows[0].reactions;
      }
      throw new Error('Reaction conflict');
    });
    reactionLocks.set(id, operation);
    void operation.catch(error => { console.error('Reaction failed', error); if (typeof cb === 'function') cb({ error: 'Tepki kaydedilemedi.' }); }).finally(() => { if (reactionLocks.get(id) === operation) reactionLocks.delete(id); });
  });
}
