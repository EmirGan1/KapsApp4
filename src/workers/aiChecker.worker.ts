import * as ort from 'onnxruntime-web/wasm';
import { Tokenizer } from '@huggingface/tokenizers';

const ASSET_ROOT = '/ai-checker';
const MODEL_PARTS = 17;
const RUNTIME_PARTS = 3;
let session: ort.InferenceSession | null = null;
let tokenizer: Tokenizer | null = null;

async function downloadParts(directory: string, count: number, progress: (done: number, total: number) => void) {
  const buffers: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const response = await fetch(`${ASSET_ROOT}/${directory}/part-${String(i).padStart(2, '0')}`, {
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`Model parçası indirilemedi (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // SPA fallback would return HTML with 200; never pass it to the inference engine.
    if (bytes.length < 1000) throw new Error('Model parçası eksik veya geçersiz.');
    buffers.push(bytes);
    total += bytes.length;
    progress(i + 1, count);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const bytes of buffers) { merged.set(bytes, offset); offset += bytes.length; }
  return merged;
}

async function load() {
  if (session && tokenizer) return;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Bu tarayıcı yerel model sıkıştırmasını desteklemiyor. Tarayıcıyı güncelleyin.');
  }
  self.postMessage({ type: 'progress', stage: 'runtime', done: 0, total: RUNTIME_PARTS });
  const runtime = await downloadParts('runtime', RUNTIME_PARTS, (done, total) =>
    self.postMessage({ type: 'progress', stage: 'runtime', done, total }));
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmBinary = runtime;
  const [tokenizerResponse, configResponse] = await Promise.all([
    fetch(`${ASSET_ROOT}/tokenizer.json`, { cache: 'no-store', credentials: 'omit' }),
    fetch(`${ASSET_ROOT}/tokenizer_config.json`, { cache: 'no-store', credentials: 'omit' }),
  ]);
  if (!tokenizerResponse.ok || !configResponse.ok) throw new Error('Tokenizer indirilemedi.');
  tokenizer = new Tokenizer(await tokenizerResponse.json(), await configResponse.json());
  self.postMessage({ type: 'progress', stage: 'model', done: 0, total: MODEL_PARTS });
  const compressed = await downloadParts('model', MODEL_PARTS, (done, total) =>
    self.postMessage({ type: 'progress', stage: 'model', done, total }));
  const decompressed = await new Response(
    new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  self.postMessage({ type: 'progress', stage: 'initializing', done: 0, total: 1 });
  session = await ort.InferenceSession.create(decompressed, { executionProviders: ['wasm'] });
  if (session.inputNames.join(',') !== 'input_ids,attention_mask' || session.outputNames[0] !== 'logits') {
    throw new Error('Modelin giriş/çıkış biçimi beklenenden farklı.');
  }
  self.postMessage({ type: 'progress', stage: 'initializing', done: 1, total: 1 });
}

self.onmessage = async (event: MessageEvent<{ id: number; text: string }>) => {
  const { id, text } = event.data;
  if (typeof text !== 'string' || !text.trim()) return;
  try {
    await load();
    // RoBERTa uses <s> and </s>; preserve both ends if input exceeds 512 tokens.
    const encoded = tokenizer!.encode(text.trim());
    const truncated = encoded.ids.length > 512;
    const ids = truncated ? [...encoded.ids.slice(0, 511), 2] : encoded.ids;
    const input = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
    const mask = new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, ids.length]);
    const result = await session!.run({ input_ids: input, attention_mask: mask });
    const logits = Array.from(result.logits.data as Float32Array);
    if (logits.length !== 2 || logits.some(value => !Number.isFinite(value))) throw new Error('Model geçersiz sonuç üretti.');
    const max = Math.max(...logits);
    const exp = logits.map(value => Math.exp(value - max));
    const sum = exp[0] + exp[1];
    self.postMessage({ type: 'result', id, scores: exp.map(value => value / sum), tokens: ids.length, truncated });
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : 'Model çalıştırılamadı.' });
  }
};
