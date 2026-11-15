import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAiChecker } from '../src/server/aiChecker';

test('the warm server model handles short and truncated inputs without returning the text', async () => {
  const checker = createAiChecker();
  checker.warm();
  try {
    const first = checker.analyze('I wrote this sentence myself.');
    assert.throws(() => checker.analyze('Concurrent input'), { status: 429 });
    const short = await first;
    assert.ok(short.tokens > 0 && short.tokens < 512);
    assert.equal(short.truncated, false);

    const start = performance.now();
    const long = await checker.analyze('This is a sample sentence. '.repeat(160));
    console.log(`Warm 512-token request: ${Math.round(performance.now() - start)} ms`);
    assert.equal(long.tokens, 512);
    assert.equal(long.truncated, true);
    for (const result of [short, long]) {
      assert.deepEqual(Object.keys(result).sort(), ['scores', 'tokens', 'truncated']);
      assert.equal(result.scores.length, 2);
      assert.ok(result.scores.every(Number.isFinite));
      assert.ok(Math.abs(result.scores[0] + result.scores[1] - 1) < 1e-9);
    }
  } finally {
    checker.stop();
  }
});
