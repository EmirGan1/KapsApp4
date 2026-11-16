import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { createClient } from '@libsql/client';
import { chromium, webkit, devices } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const listener = createServer();
await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
const address = listener.address();
assert.ok(address && typeof address !== 'string');
const { port } = address;
await new Promise<void>(resolve => listener.close(() => resolve()));
const directory = await mkdtemp(join(tmpdir(), 'kaps-desklib-'));
await symlink(join(root, 'dist'), join(directory, 'dist'), 'dir');
const url = 'file:' + join(directory, 'test.db');
const db = createClient({ url });
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', PORT: String(port), TURSO_DATABASE_URL: url };
delete env['TURSO_AUTH_TOKEN'];
delete env['LIBSQL_AUTH_TOKEN'];
const child = spawn(process.execPath, [join(root, 'dist/server.cjs')], { cwd: directory, env });
const exited = once(child, 'exit');
let logs = '';
child.stdout.on('data', data => { logs += data; });
child.stderr.on('data', data => { logs += data; });
const base = `http://127.0.0.1:${port}`;
const jobs = base + '/api/ai-checker/jobs';
const token = 'desklib-browser-test';
const auth = { Authorization: `Bearer ${token}` };
const longInput = process.env.DESKLIB_BROWSER_LONG === "1";
const input = "The neighbors arrived before the storm and waited in the kitchen for the bus driver. I was still looking for the keys when a woman outside called to say the road would reopen before dark. ".repeat(longInput ? 149 : 16);
const engine = process.env.DESKLIB_BROWSER === 'webkit' ? webkit : chromium;
let browser: Awaited<ReturnType<typeof engine.launch>> | undefined;

try {
  let ready = false;
  for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt++) {
    ready = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) }).then(r => r.ok, () => false);
    if (ready) break;
    await setTimeout(100);
  }
  assert.ok(ready, logs);
  await db.execute({
    sql: "INSERT INTO users (username,password,token,status) VALUES ('Detector QA','fixture',?,'approved'),('Other QA','fixture','other-fixture','approved')",
    args: [token],
  });
  assert.equal((await fetch(base + '/api/ai-checker/health', { headers: auth })).status, 200);
  assert.equal((await fetch(jobs)).status, 401);
  const wrong = await fetch(jobs, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{"text":"private invalid JSON' });
  assert.equal(wrong.status, 400);
  const large = await fetch(jobs, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(330 * 1024) }) });
  assert.equal(large.status, 413);
  const tooManyChars = await fetch(jobs, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(50_001) }) });
  assert.equal(tooManyChars.status, 400);

  browser = await engine.launch();
  const { defaultBrowserType: _defaultBrowserType, ...mobile } = devices['iPhone 13'];
  const context = await browser.newContext(mobile);
  await context.addInitScript(({ token }) => {
    localStorage.setItem('lan_token', token);
    localStorage.setItem('lan_username', 'Detector QA');
    localStorage.setItem('lan_user_id', '1');
  }, { token });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === base ? route.continue() : route.abort();
  });
  await page.goto(base + '/ai-checker');
  const field = page.getByRole('textbox', { name: 'Analiz edilecek metin' });
  await field.fill(input);
  const submitted = page.waitForResponse(response => response.url() === jobs && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Metni analiz et' }).tap();
  const accepted = await submitted;
  assert.equal(accepted.status(), 202);
  const { id } = await accepted.json();
  const other = await fetch(`${jobs}/${id}?model=desklib`, { headers: { Authorization: 'Bearer other-fixture' } });
  assert.equal(other.status, 404);

  await page.goto(base + '/ajanda');
  await page.goto(base + '/ai-checker');
  const copy = page.getByRole('button', { name: 'Sonucu kopyala' });
  await copy.waitFor({ timeout: longInput ? 240_000 : 60_000 });
  const panel = page.locator('main').filter({ has: field });
  const before = await panel.evaluate(el => el.scrollTop);
  await copy.scrollIntoViewIfNeeded();
  assert.ok(await panel.evaluate(el => el.scrollTop) > before, 'mobile detector scrolls to the result');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const finished = await fetch(`${jobs}/${id}?model=desklib`, { headers: auth });
  assert.equal(finished.headers.get('cache-control'), 'no-store');
  const job = await finished.json();
  assert.equal(job.result.model, 'desklib/ai-text-detector-v1.01');
  assert.equal(job.status, 'done');
  assert.ok(job.result.tokens > 0 && job.result.scores);
  if (longInput) assert.ok(job.result.words > 3500);
  assert.ok(!JSON.stringify(job).includes('The neighbors arrived'));
  assert.ok(!logs.includes('The neighbors arrived') && !logs.includes('private invalid JSON'));
  assert.ok(await page.evaluate(() => [localStorage, sessionStorage].every(store =>
    Object.entries(store).every(([key, value]) => !key.startsWith('kapsapp.ai-checker.') && !value.includes('The neighbors arrived')))));
  await page.reload();
  await copy.waitFor();
  assert.equal(await field.inputValue(), '');
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await copy.scrollIntoViewIfNeeded();
    assert.ok(await copy.isVisible());
  }
  console.log(`PASS ${engine.name()}: real model, auth, limits, navigation recovery, mobile scrolling, client privacy and reload`);
} finally {
  await browser?.close();
  db.close();
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await exited;
  }
  await rm(directory, { recursive: true, force: true });
}
