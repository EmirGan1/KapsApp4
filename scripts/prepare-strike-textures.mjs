import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const manifest = JSON.parse(await readFile(new URL('../src/games/kapsstrike/catalogPbr.json', import.meta.url), 'utf8'));
const output = new URL('../public/kapsstrike/catalog-v1/', import.meta.url).pathname;
await mkdir(output, { recursive: true });

const queue = Object.entries(manifest.files);
await Promise.all(Array.from({ length: 6 }, async () => {
  for (;;) {
    const entry = queue.shift();
    if (!entry) return;
    const [name, source] = entry;
    const stem = name.replace(/\.[^.]+$/, '');
    const target = output + stem + '.webp';
    try { await access(target); continue; } catch {}
    const input = output + '.' + process.pid + '-' + name;
    const temporary = target + '.' + process.pid + '.webp';
    try {
      await run('curl', ['-fsSL', '--retry', '2', '--max-time', '120', source.url, '-o', input]);
      const bytes = await readFile(input);
      if (bytes.length !== source.size || createHash('md5').update(bytes).digest('hex') !== source.md5) {
        throw new Error('Poly Haven source checksum mismatch: ' + name);
      }
      const dataMap = /_(nor_gl|arm)_/.test(name);
      await run('convert', [input, '-strip', '-quality', dataMap ? '86' : '80', temporary]);
      await rename(temporary, target);
    } finally {
      await rm(input, { force: true });
      await rm(temporary, { force: true });
    }
  }
}));
console.log('KapsStrike PBR textures ready.');
