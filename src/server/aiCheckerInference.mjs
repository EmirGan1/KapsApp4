import { parentPort, workerData } from 'node:worker_threads';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-node';

// The model was uploaded once via SFTP. Neither the browser nor the server
// downloads a model at request time; no user text is written to disk or logs.
const { modelRoot } = workerData;
const modelFile = join(modelRoot, 'model_quantized.onnx');

async function loadModel() {
  if (!existsSync(modelFile)) throw new Error('Local ONNX file missing');
  const tokenizer = new Tokenizer(
    JSON.parse(readFileSync(join(modelRoot, 'tokenizer.json'), 'utf8')),
    JSON.parse(readFileSync(join(modelRoot, 'tokenizer_config.json'), 'utf8')),
  );
  const session = await ort.InferenceSession.create(modelFile, {
    executionProviders: ['cpu'],
    intraOpNumThreads: 2,
    interOpNumThreads: 1,
  });
  if (session.inputNames.slice().sort().join(',') !== 'attention_mask,input_ids'
      || session.outputNames[0] !== 'logits') {
    throw new Error('Unexpected ONNX model inputs/outputs');
  }
  return { session, tokenizer };
}

const modelReady = loadModel();
modelReady.then(
  () => parentPort?.postMessage({ type: 'ready' }),
  () => parentPort?.postMessage({ type: 'unavailable' }),
);

parentPort?.on('message', async ({ id, text }) => {
  try {
    const { session, tokenizer } = await modelReady;
    if (typeof text !== 'string' || !text.trim() || text.length > 20000) throw new Error('Invalid input');
    const encoded = tokenizer.encode(text);
    const truncated = encoded.ids.length > 512;
    const ids = truncated ? [...encoded.ids.slice(0, 511), 2] : encoded.ids;
    if (!ids.length) throw new Error('No tokens');
    const tokens = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
    const attention = new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, ids.length]);
    const { logits } = await session.run({ input_ids: tokens, attention_mask: attention });
    const values = Array.from(logits.data);
    if (values.length !== 2 || values.some(x => !Number.isFinite(x))) throw new Error('Invalid logits');
    const max = Math.max(...values);
    const weights = values.map(x => Math.exp(x - max));
    const sum = weights[0] + weights[1];
    parentPort.postMessage({
      type: 'result', id,
      result: { scores: weights.map(x => x / sum), tokens: ids.length, truncated },
    });
  } catch {
    // Deliberately avoid logging or returning supplied text or error details.
    parentPort?.postMessage({ type: 'error', id });
  }
});
