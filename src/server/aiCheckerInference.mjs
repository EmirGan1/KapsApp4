import { parentPort, workerData } from 'node:worker_threads';
import { createReadStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-node';

const { assetRoot } = workerData;

async function loadModel() {
  const tokenizer = new Tokenizer(
    JSON.parse(readFileSync(join(assetRoot, 'tokenizer.json'), 'utf8')),
    JSON.parse(readFileSync(join(assetRoot, 'tokenizer_config.json'), 'utf8')),
  );

  async function* compressedParts() {
    for (let i = 0; i < 17; i++) {
      yield* createReadStream(join(assetRoot, 'model', `part-${String(i).padStart(2, '0')}`));
    }
  }

  const model = Buffer.allocUnsafe(125855418);
  let offset = 0;
  await pipeline(Readable.from(compressedParts()), createGunzip(), async source => {
    for await (const chunk of source) {
      if (offset + chunk.length > model.length) throw new Error('Unexpected model size');
      offset += chunk.copy(model, offset);
    }
  });
  if (offset !== model.length) throw new Error('Incomplete model');

  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['cpu'],
    intraOpNumThreads: 2,
    interOpNumThreads: 1,
  });
  if (session.inputNames.join(',') !== 'input_ids,attention_mask' || session.outputNames[0] !== 'logits') {
    throw new Error('Unexpected model interface');
  }
  return { session, tokenizer };
}

// Start loading as soon as the server creates this worker.
const modelReady = loadModel();
modelReady.catch(() => parentPort.postMessage({ type: 'unavailable' }));

parentPort.on('message', async ({ id, text }) => {
  try {
    const { session, tokenizer } = await modelReady;
    const encoded = tokenizer.encode(text);
    const truncated = encoded.ids.length > 512;
    const ids = truncated ? [...encoded.ids.slice(0, 511), 2] : encoded.ids;
    const input = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
    const mask = new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, ids.length]);
    const { logits } = await session.run({ input_ids: input, attention_mask: mask });
    const values = Array.from(logits.data);
    if (values.length !== 2 || values.some(value => !Number.isFinite(value))) throw new Error('Invalid model output');
    const max = Math.max(...values);
    const exps = values.map(value => Math.exp(value - max));
    const sum = exps[0] + exps[1];
    parentPort.postMessage({ type: 'result', id, result: {
      scores: exps.map(value => value / sum),
      tokens: ids.length,
      truncated,
    } });
  } catch {
    // Never attach input or exception details to a reply or log.
    parentPort.postMessage({ type: 'error', id });
  }
});
