import { parentPort, workerData } from 'node:worker_threads';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-node';

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
    || session.outputNames[0] !== 'logits') throw new Error('Unexpected model interface');
  return { session, tokenizer };
}

function languageHint(text) {
  // Conservative heuristic, not a language detector. The English-only model
  // must not issue affirmative AI authorship claims on likely Turkish text.
  const words = (text.toLocaleLowerCase('tr').match(/\p{L}+/gu) || []);
  const tr = new Set(['ve', 'bir', 'bu', 'için', 'olarak', 'ancak', 'çünkü', 'değil',
    'çok', 'olan', 'gibi', 'daha', 'ile', 'ama', 'kadar', 'yani', 'sonra', 'bile',
    'ben', 'sen', 'biz', 'bunun', 'şekilde', 'neden', 'nasıl', 'yapılan']);
  const en = new Set(['the', 'and', 'of', 'to', 'for', 'with', 'is', 'was', 'that',
    'this', 'they', 'have', 'from', 'are', 'which', 'because', 'were']);
  const turkishHits = words.filter(w => tr.has(w)).length;
  const englishHits = words.filter(w => en.has(w)).length;
  const turkishLetters = (text.match(/[ğıüşöçİĞÜŞÖÇ]/g) || []).length;
  return (turkishLetters >= 3 && turkishHits >= 2)
    || (turkishHits >= 5 && turkishHits > englishHits * 1.5)
    ? 'likely_turkish' : 'not_identified';
}

function chooseWindows(ids) {
  // Strip the RoBERTa <s> and </s> token, then reinsert them in each
  // independently evaluated window. Do not silently use only the beginning.
  if (ids[0] !== 0 || ids.at(-1) !== 2) throw new Error('Unexpected tokenizer output');
  const body = ids.slice(1, -1);
  const wrap = part => [0, ...part, 2];
  if (body.length <= 240) return { windows: [wrap(body)], truncated: false };
  if (body.length <= 800) {
    const midpoint = Math.ceil(body.length / 2);
    return { windows: [wrap(body.slice(0, midpoint)), wrap(body.slice(midpoint))], truncated: false };
  }
  const size = 350;
  const middle = Math.floor((body.length - size) / 2);
  return {
    windows: [wrap(body.slice(0, size)), wrap(body.slice(middle, middle + size)), wrap(body.slice(-size))],
    truncated: body.length > size * 3,
  };
}

async function runWindow(session, ids) {
  const size = ids.length;
  const output = await session.run({
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, size]),
    attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, size]),
  });
  const values = Array.from(output.logits?.data || []);
  if (values.length !== 2 || values.some(v => !Number.isFinite(v))) throw new Error('Invalid logits');
  const max = Math.max(...values);
  const weights = values.map(v => Math.exp(v - max));
  return weights[1] / (weights[0] + weights[1]);
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
    const words = (text.trim().match(/\S+/g) || []).length;
    const { windows, truncated } = chooseWindows(tokenizer.encode(text).ids);
    const segmentAi = [];
    for (const window of windows) segmentAi.push(await runWindow(session, window));
    const ai = segmentAi.reduce((sum, score) => sum + score, 0) / segmentAi.length;
    const tokens = windows.reduce((sum, window) => sum + window.length, 0);
    parentPort.postMessage({ type: 'result', id, result: {
      scores: [1 - ai, ai], tokens, truncated, words,
      segmentAi, language: languageHint(text),
    } });
  } catch {
    // User text never enters server logs, persistent files or error messages.
    parentPort?.postMessage({ type: 'error', id });
  }
});
