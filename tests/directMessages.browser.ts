import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Server } from 'socket.io';
import { createClient } from '@libsql/client';
import { chromium, webkit, devices } from 'playwright';
import { DmPresence, registerDirectMessages } from '../src/server/directMessages';
const db = createClient({ url: ':memory:' });
await db.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT,sender INTEGER,receiver INTEGER,type TEXT,content TEXT,reply_to INTEGER,reactions TEXT,file_name TEXT,file_size TEXT,room_id TEXT,status TEXT,is_read INTEGER,read_at TEXT,created_at TEXT)");
await db.execute('CREATE TABLE notifications (user_id INTEGER,sender_id INTEGER,type TEXT,read INTEGER)');
let pushes = 0;
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4199, strictPort: true }, plugins: [{ name: 'dm-browser-fixture', configureServer(s) {
  s.middlewares.use('/__dm', async (_req, res) => { res.setHeader('Content-Type','text/html'); res.end(await s.transformIndexHtml('/__dm','<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/directMessages.fixture.tsx"></script>')); });
} }] });
await server.listen();
const io = new Server(server.httpServer!); const presence = new DmPresence();
io.use((s, next) => { s.data.user = { id: Number(s.handshake.auth.id) }; next(); });
io.on('connection', socket => {
 const me = Number(socket.data.user.id);
 const users = [1,2].map(id => ({ id, username: `user${id}`, status: 1, avatar: null }));
 socket.on('get_friends', cb => cb(users.filter(u => u.id !== me)));
 socket.on('get_groups', cb => cb([])); socket.on('get_all_users', cb => cb(users)); socket.on('get_chat_read', (_room, cb) => cb([]));
 registerDirectMessages({ io, socket, db, presence, getUser: async id => users.find(u => u.id === id), notify: async () => {}, push: { deliver: async () => { pushes++; } } });
});
const browserType = process.env.DM_BROWSER === 'webkit' ? webkit : chromium;
const browser = await browserType.launch({ headless: true, ...(process.env.DM_EXECUTABLE ? { executablePath: process.env.DM_EXECUTABLE } : {}) });
const contexts: any[] = [];
try {
 for (const mobile of [false,true]) {
  await db.execute('DELETE FROM messages'); pushes = 0;
  const options = mobile ? (browserType === webkit ? devices['iPhone 13'] : devices['Pixel 7']) : { viewport: { width: 1365, height: 900 } };
  const aContext = await browser.newContext(options), bContext = await browser.newContext(options); contexts.push(aContext,bContext);
  const a = await aContext.newPage(), b = await bContext.newPage();
  const errors: string[] = []; for (const page of [a,b]) page.on('pageerror', error => errors.push(error.message));
  await a.goto('http://127.0.0.1:4199/__dm?user=1'); await b.goto('http://127.0.0.1:4199/__dm?user=2');
  const composer = a.locator('[data-chat-composer]'); await composer.waitFor(); await b.locator('[data-chat-composer]').waitFor();
  await composer.fill('DM browser original'); await composer.press('Enter');
  await b.locator('[data-message-id] p').filter({ hasText: /^DM browser original$/ }).waitFor();
  await a.getByTitle('Görüldü (Okundu)').waitFor();
  assert.equal(pushes, 0);
  const firstId = await a.locator('[data-message-id]').first().getAttribute('data-message-id'); assert.ok(Number(firstId) > 0);
  await b.getByTitle('Yanıtla', { exact: true }).first().click();
  await b.getByLabel('Yanıtı iptal et').click();
  assert.equal(await b.getByLabel('Yanıtı iptal et').count(), 0);
  await b.getByTitle('Yanıtla', { exact: true }).first().click();
  await b.getByText('kişisine yanıtlanıyor:', { exact: false }).waitFor();
  await b.locator('[data-chat-composer]').fill('Reply persisted'); await b.locator('[data-chat-composer]').press('Enter');
  await a.locator('[data-message-id] p').filter({ hasText: /^Reply persisted$/ }).waitFor();
  assert.equal((await db.execute("SELECT reply_to FROM messages WHERE content='Reply persisted'")).rows[0].reply_to, Number(firstId));
  await a.getByTitle('Tepki ekle', { exact: true }).first().click(); await a.getByRole('button', { name: 'Tüm emojiler', exact: true }).click();
  await a.getByLabel('Emoji ara').fill('thumbs up: medium skin');
  await a.getByRole('button', { name: 'thumbs up: medium skin tone', exact: true }).click();
  await b.getByText('👍🏽', { exact: true }).waitFor();
  await b.reload(); await b.locator('[data-message-id] p').filter({ hasText: /^Reply persisted$/ }).waitFor(); await b.getByText('👍🏽', { exact: true }).waitFor();
  assert.equal(await b.locator('[title="user1"] img').count(), 0);
  await b.evaluate(() => (window as any).dm.foreground(false));
  await composer.fill('Background delivery'); await composer.press('Enter');
  await b.locator('[data-message-id] p').filter({ hasText: /^Background delivery$/ }).waitFor(); await a.getByTitle('İletildi', { exact: true }).waitFor();
  assert.ok(pushes > 0);
  const latest = (await db.execute("SELECT status FROM messages WHERE content='Background delivery'")).rows[0]; assert.equal(latest.status, 'delivered');
  await b.evaluate(() => (window as any).dm.foreground(true));
  await a.waitForFunction(() => document.querySelectorAll('[title="Görüldü (Okundu)"]').length === 2);
  await b.getByText('DM browser original', { exact: true }).last().click();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(`PASS ${browserType.name()} ${mobile ? 'mobile emulation' : 'desktop'}: two sessions, replies, full emoji search, refresh, receipt transitions, foreground/background push`);
  await aContext.close(); await bContext.close();
 }
} finally { await Promise.all(contexts.map(c => c.close())); await browser.close(); await new Promise<void>(resolve => io.close(() => resolve())); await server.close(); db.close(); }
