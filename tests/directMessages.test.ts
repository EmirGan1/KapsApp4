import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { createClient } from '@libsql/client';
import { DmPresence, registerDirectMessages, validEmoji, changeReaction } from '../src/server/directMessages';
import emojis from '../src/shared/emojiData.json';
import { setupChatSocketHandlers } from '../src/server/socket';
import { applyAudioOutput } from '../src/utils/audioOutput';

const wait = (socket: Socket, event: string, predicate = (_: any) => true) => new Promise<any>((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timed out: ${event}`)); }, 4000);
  const listener = (data: any) => { if (predicate(data)) { clearTimeout(timer); socket.off(event, listener); resolve(data); } };
  socket.on(event, listener);
});
const emit = (socket: Socket, event: string, data: any) => socket.timeout(4000).emitWithAck(event, data);
test('Unicode emoji sequences and one reaction per user preserve legacy hearts', () => {
  for (const emoji of ['❤️','👍🏽','👨‍👩‍👧‍👦','🇹🇷','1️⃣','🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}']) assert.ok(validEmoji(emoji), emoji);
  for (const [emoji] of emojis) assert.ok(validEmoji(emoji), emoji);
  for (const emoji of ['abc','<script>','😀😀','', 'x'.repeat(100)]) assert.equal(validEmoji(emoji), false);
  const old = [{ user_id: 1, emoji: '❤️' }, { user_id: 2, emoji: '❤️' }];
  assert.deepEqual(changeReaction(old, 1, '👍🏽'), [{ user_id: 2, emoji: '❤️' }, { user_id: 1, emoji: '👍🏽' }]);
  assert.deepEqual(changeReaction(old, 1, '❤️'), [{ user_id: 2, emoji: '❤️' }]);
});
test('presence belongs to each socket and expires without a heartbeat', () => {
  const presence = new DmPresence();
  presence.enter('a', 1, 2); presence.enter('b', 1, 3); presence.leave('b');
  assert.ok(presence.viewing(1, 2)); assert.equal(presence.viewing(1, 2, 'b'), false);
  const now = Date.now; Date.now = () => now() + 46_000;
  try { assert.equal(presence.viewing(1, 2), false); } finally { Date.now = now; }
  presence.leave('a'); assert.equal(presence.viewing(1, 2), false);
});
test('audio routing is verified, rolls back on failure, and never mutes media', async () => {
  const make = (fail = false): any => ({ sinkId: '', muted: false, setSinkId: async function(id: string) { if (fail && id === 'bt') throw new Error('disconnected'); this.sinkId = id; } });
  const a = make(), b = make(true);
  await assert.rejects(applyAudioOutput([a, b], 'bt'));
  assert.equal(a.sinkId, ''); assert.equal(a.muted, false);
  await applyAudioOutput([a], 'wired'); assert.equal(a.sinkId, 'wired');
  await assert.rejects(applyAudioOutput([{} as any], 'speaker'));
  await assert.rejects(applyAudioOutput([{ sinkId: '', setSinkId: async () => {} } as any], 'fake'));
});
test('real sockets: persisted replies, delivery/read evidence, multiple devices, push and reactions', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT,sender INTEGER,receiver INTEGER,type TEXT,content TEXT,reply_to INTEGER,reactions TEXT,file_name TEXT,file_size TEXT,room_id TEXT,status TEXT,is_read INTEGER,read_at TEXT,created_at TEXT)");
  await db.execute('CREATE TABLE notifications (user_id INTEGER,sender_id INTEGER,type TEXT,read INTEGER)');
  const http = createServer(); const io = new Server(http); const presence = new DmPresence();
  const pushes: any[] = []; const notifications: any[] = [];
  io.use((s, next) => { s.data.user = { id: Number(s.handshake.auth.id) }; next(); });
  io.on('connection', socket => {
    setupChatSocketHandlers(io, socket, socket.data.user, db, {}, async (id: number) => ({ id }));
    registerDirectMessages({ io, socket, db, presence,
    getUser: async id => id > 0 && id <= 3 ? { id, username: `user${id}` } : undefined,
    notify: async (...args) => { notifications.push(args); }, push: { deliver: async (...args: any[]) => { pushes.push(args); } } });
  });
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const url = `http://127.0.0.1:${(http.address() as any).port}`;
  const sockets: Socket[] = [];
  async function session(id: number) { const s = connect(url, { auth: { id }, forceNew: true }); sockets.push(s); await new Promise<void>(resolve => s.once('connect', () => resolve())); return s; }
  const a = await session(1), b = await session(2), secondB = await session(2), outsider = await session(3);
  try {
    const received = wait(b, 'new_message'); const secondReceived = wait(secondB, 'new_message');
    const sent = await emit(a, 'send_message', { receiver: 2, type: 'text', content: 'original', client_id: 'test' });
    const original = await received; await secondReceived;
    assert.equal(original.id, sent.message.id); assert.equal(typeof original.id, 'number'); assert.equal(original.status, 'sent');
    assert.equal((await db.execute('SELECT count(*) AS n FROM messages')).rows[0].n, 1);
    const delivered = wait(a, 'dm:receipt', d => d.status === 'delivered');
    b.emit('dm:delivered', { partnerId: 1, messageIds: [original.id] }); await delivered;
    b.emit('dm:mark_read', { partnerId: 1, messageIds: [original.id] });
    // A round trip on the same socket lets the preceding async operation finish before checking persistence.
    await emit(b, 'get_messages', { friendId: 1 });
    assert.equal((await db.execute('SELECT status FROM messages')).rows[0].status, 'delivered');
    b.emit('dm:enter_chat', { partnerId: 1 });
    const read = wait(a, 'dm:receipt', d => d.status === 'read');
    b.emit('dm:mark_read', { partnerId: 1, messageIds: [original.id] }); await read;
    assert.equal((await db.execute('SELECT status FROM messages')).rows[0].status, 'read');
    const pushesBefore = pushes.length;
    const reply = await emit(a, 'send_message', { receiver: 2, type: 'image', content: '/uploads/example.png', reply_to: original.id });
    assert.equal(reply.message.reply_message.content, 'original');
    await emit(a, 'get_messages', { friendId: 2 }); assert.equal(pushes.length, pushesBefore);
    b.disconnect();
    const third = await emit(a, 'send_message', { receiver: 2, type: 'text', content: 'after leave' });
    await emit(a, 'get_messages', { friendId: 2 }); assert.ok(pushes.length > pushesBefore);
    // A second device leaving its different conversation cannot clear another device's presence.
    secondB.emit('dm:enter_chat', { partnerId: 1 });
    secondB.emit('dm:leave_chat');
    const rejected = await emit(outsider, 'send_message', { receiver: 1, type: 'text', content: 'invalid reply', reply_to: original.id });
    assert.ok(rejected.error);
    await Promise.all([
      emit(a, 'react_message', { type: 'private', message_id: original.id, emoji: '👍🏽' }),
      emit(secondB, 'react_message', { type: 'private', message_id: original.id, emoji: '🇹🇷' }),
    ]);
    assert.ok((await emit(outsider, 'react_message', { type: 'private', message_id: original.id, emoji: '🔥' })).error);
    let history = await emit(a, 'get_messages', { friendId: 2 });
    assert.equal(history[0].reactions.length, 2); assert.equal(history[0].status, 'read');
    assert.equal(history[1].reply_to, original.id); assert.equal(history[1].reply_message.sender_name, 'user1');
    await emit(a, 'react_message', { type: 'private', message_id: original.id, emoji: '❤️' });
    await emit(a, 'react_message', { type: 'private', message_id: original.id, emoji: '❤️' });
    history = await emit(a, 'get_messages', { friendId: 2 }); assert.equal(history[0].reactions.length, 1);
    const reconnect = await session(2);
    const persisted = await emit(reconnect, 'get_messages', { friendId: 1 });
    assert.equal(persisted[0].is_read, 1); assert.equal(persisted[1].reply_to, original.id);
    assert.equal(third.message.status, 'sent'); assert.ok(notifications.length > 0);
    let leaked = false;
    outsider.on('new_message', () => { leaked = true; });
    outsider.emit('join_room', 'dm-user:1');
    await emit(outsider, 'get_messages', { friendId: 1 });
    await emit(a, 'send_message', { receiver: 2, type: 'text', content: 'private-room-test' });
    await emit(outsider, 'get_messages', { friendId: 1 });
    assert.equal(leaked, false);
    await db.execute("CREATE TRIGGER fail_test_message BEFORE INSERT ON messages WHEN NEW.content='reject-insert' BEGIN SELECT RAISE(FAIL,'test write failure'); END");
    const failed = await emit(a, 'send_message', { receiver: 2, type: 'text', content: 'reject-insert' });
    assert.ok(failed.error);
    assert.equal((await db.execute("SELECT count(*) AS n FROM messages WHERE content='reject-insert'")).rows[0].n, 0);
  } finally { sockets.forEach(s => s.disconnect()); await new Promise<void>(resolve => io.close(() => resolve())); db.close(); }
});
