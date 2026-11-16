import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createAiChecker } from '../src/server/aiChecker';

test('private AI jobs never expose submitted text and are account-scoped', () => {
  const checker = createAiChecker();
  const secret = 'My private essay must not appear in job metadata';
  try {
    const id = checker.start('student-a', secret);
    assert.match(id, /^[a-f0-9-]{36}$/i);
    const ownState = checker.status('student-a', id);
    assert.ok(ownState);
    assert.equal(checker.status('student-b', id), null);
    assert.ok(!JSON.stringify(ownState).includes(secret));
  } finally {
    checker.stop();
  }
});

const modelPath = resolve(process.env.AI_DETECTOR_MODEL_DIR || 'models/ai-detector', 'model_quantized.onnx');
test('local ONNX model accepts short and truncated inputs and keeps scores-only results',
  { skip: !existsSync(modelPath) && 'SFTP-provisioned ONNX weights not present in source repository' },
  async () => {
    const checker = createAiChecker();
    checker.warm();
    try {
      const first = checker.analyze('I wrote this sentence myself.');
      const second = checker.analyze('Another English sentence from a different request.');
      const [short, queued] = await Promise.all([first, second]);
      assert.ok(short.tokens > 0 && short.tokens <= 512);
      assert.equal(short.truncated, false);
      assert.ok(queued.tokens > 0);

      const start = performance.now();
      const long = await checker.analyze('This is a sample sentence. '.repeat(160));
      console.log(`Warm 512-token request: ${Math.round(performance.now() - start)} ms`);
      assert.equal(long.tokens, 512);
      assert.equal(long.truncated, true);
      for (const result of [short, queued, long]) {
        assert.deepEqual(Object.keys(result).sort(), ['scores', 'tokens', 'truncated']);
        assert.equal(result.scores.length, 2);
        assert.ok(result.scores.every(Number.isFinite));
        assert.ok(Math.abs(result.scores[0] + result.scores[1] - 1) < 1e-9);
      }
    } finally {
      checker.stop();
    }
  },
);
