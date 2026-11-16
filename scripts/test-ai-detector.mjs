// Manual production smoke test for the server-side, locally provisioned detector.
// Does not download model files, save text, restart PM2 or touch the database.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-node';

const root = resolve(process.env.AI_DETECTOR_MODEL_DIR || 'models/ai-detector');
const model = join(root, 'model_quantized.onnx');

try {
  for (const filename of ['model_quantized.onnx', 'tokenizer.json', 'tokenizer_config.json']) {
    if (!existsSync(join(root, filename))) throw new Error('Eksik model dosyası: ' + filename);
  }
  const tokenizer = new Tokenizer(
    JSON.parse(readFileSync(join(root, 'tokenizer.json'), 'utf8')),
    JSON.parse(readFileSync(join(root, 'tokenizer_config.json'), 'utf8')),
  );
  const encoded = tokenizer.encode('This is a simple example written by a human.');
  if (!encoded.ids?.length) throw new Error('Tokenizer boş token döndürdü.');
  const session = await ort.InferenceSession.create(model, { executionProviders: ['cpu'] });
  const ids = encoded.ids;
  const output = await session.run({
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), [1, ids.length]),
  });
  if (!output.logits || output.logits.dims.join(',') !== '1,2') throw new Error('Beklenmeyen model çıktısı.');
  const values = Array.from(output.logits.data);
  if (!values.every(Number.isFinite)) throw new Error('Geçersiz skorlar.');
  const e = values.map(x => Math.exp(x - Math.max(...values)));
  const total = e[0] + e[1];
  console.log('AI DETECTOR SMOKE TEST: OK (runtime only)');
  console.log('WARNING: This smoke test does not validate detection accuracy or false-positive rates.');
  console.log('Tokens:', ids.length);
  console.log('İnsan (sınıf 0):', (100 * e[0] / total).toFixed(2) + '%');
  console.log('AI (sınıf 1):', (100 * e[1] / total).toFixed(2) + '%');
  console.log('Not: Bu skorlar kalibre edilmiş doğruluk oranı değildir.');
} catch (error) {
  console.error('AI DETECTOR SMOKE TEST: FAIL', error instanceof Error ? error.message : 'Bilinmeyen hata');
  process.exitCode = 1;
}
