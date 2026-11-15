import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { test } from 'node:test';
import * as ort from 'onnxruntime-web/wasm';
import { Tokenizer } from '@huggingface/tokenizers';

test('packaged model and tokenizer run locally with two finite outputs', async () => {
  const root = join(process.cwd(), 'public/ai-checker');
  const runtime = Buffer.concat(Array.from({ length: 3 }, (_, i) => readFileSync(join(root, `runtime/part-${String(i).padStart(2, '0')}`))));
  const compressed = Buffer.concat(Array.from({ length: 17 }, (_, i) => readFileSync(join(root, `model/part-${String(i).padStart(2, '0')}`))));
  const model = gunzipSync(compressed);
  assert.equal(model.length, 125855418);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmBinary = runtime;
  const tokenizer = new Tokenizer(
    JSON.parse(readFileSync(join(root, 'tokenizer.json'), 'utf8')),
    JSON.parse(readFileSync(join(root, 'tokenizer_config.json'), 'utf8')),
  );
  const ids = tokenizer.encode('I wrote this sentence myself.').ids;
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  try {
    assert.deepEqual(session.inputNames, ['input_ids', 'attention_mask']);
    const result = await session.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
      attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, ids.length]),
    });
    const scores = Array.from(result.logits.data as Float32Array);
    assert.equal(scores.length, 2);
    assert.ok(scores.every(Number.isFinite));
  } finally {
    await session.release();
  }
});
