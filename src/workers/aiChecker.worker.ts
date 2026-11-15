import * as ort from 'onnxruntime-web/wasm';
import { Tokenizer } from '@huggingface/tokenizers';

const ASSET_ROOT = '/ai-checker';
const MODEL_PARTS = 17;
const RUNTIME_PARTS = 3;
const PARTS_PER_BATCH = 4;
type WorkerRequest = { type: 'preload' } | { type: 'analyze'; id: number; text: string };
let modelPromise: Promise<{ session: ort.InferenceSession; tokenizer: Tokenizer }> | undefined;

async function fetchAsset(path: string, signal: AbortSignal) {
  const response = await fetch(`${ASSET_ROOT}/${path}`, { cache: 'no-store', credentials: 'omit', signal });
  if (!response.ok) throw new Error(`Model dosyası yüklenemedi (${response.status}).`);
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Model dosyası eksik veya geçersiz.');
  }
  return response;
}

async function* fetchParts(directory: string, count: number, signal: AbortSignal) {
  for (let start = 0; start < count; start += PARTS_PER_BATCH) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(PARTS_PER_BATCH, count - start) }, async (_, offset) => {
        const index = String(start + offset).padStart(2, '0');
        const response = await fetchAsset(`${directory}/part-${index}`, signal);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length < 1000) throw new Error('Model parçası eksik veya geçersiz.');
        return bytes;
      }),
    );
    yield* batch;
  }
}

function streamParts(directory: string, count: number, signal: AbortSignal) {
  const parts = fetchParts(directory, count, signal);
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      const part = await parts.next();
      if (part.done) controller.close();
      else controller.enqueue(part.value);
    },
    async cancel() {
      await parts.return(undefined);
    },
  });
}

async function initializeModel(signal: AbortSignal) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Bu tarayıcı yerel model sıkıştırmasını desteklemiyor. Tarayıcıyı güncelleyin.');
  }
  const modelStream = streamParts('model', MODEL_PARTS, signal).pipeThrough(new DecompressionStream('gzip'));
  const [runtime, model, config, tokenizerData] = await Promise.all([
    new Response(streamParts('runtime', RUNTIME_PARTS, signal)).arrayBuffer(),
    new Response(modelStream).arrayBuffer(),
    fetchAsset('tokenizer_config.json', signal).then(response => response.json()),
    fetchAsset('tokenizer.json', signal).then(response => response.json()),
  ]);
  const tokenizer = new Tokenizer(tokenizerData, config);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmBinary = new Uint8Array(runtime);
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  if (session.inputNames.join(',') !== 'input_ids,attention_mask' || session.outputNames[0] !== 'logits') {
    await session.release();
    throw new Error('Modelin giriş/çıkış biçimi beklenenden farklı.');
  }
  return { session, tokenizer };
}

function loadModel() {
  if (modelPromise) return modelPromise;
  const controller = new AbortController();
  modelPromise = initializeModel(controller.signal).catch(error => {
    controller.abort();
    modelPromise = undefined;
    throw error;
  });
  return modelPromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === 'preload') {
    // A failed preload can be retried when the user analyzes text.
    await loadModel().catch(() => {});
    return;
  }
  const { id, text } = event.data;
  if (typeof text !== 'string' || !text.trim()) return;
  try {
    const { session, tokenizer } = await loadModel();
    // RoBERTa uses <s> and </s>; preserve both ends if input exceeds 512 tokens.
    const encoded = tokenizer.encode(text.trim());
    const truncated = encoded.ids.length > 512;
    const ids = truncated ? [...encoded.ids.slice(0, 511), 2] : encoded.ids;
    const input = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]);
    const mask = new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, ids.length]);
    const result = await session.run({ input_ids: input, attention_mask: mask });
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
