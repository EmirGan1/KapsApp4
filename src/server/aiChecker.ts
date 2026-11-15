import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

export const AI_CHECKER_PATH = '/api/ai-checker/analyze';
export type AiCheckerResult = { scores: number[]; tokens: number; truncated: boolean };

export class AiCheckerError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Job = {
  id: number;
  resolve: (result: AiCheckerResult) => void;
  reject: (error: AiCheckerError) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function createAiChecker() {
  let worker: Worker | undefined;
  let pending: Job | undefined;
  let requestId = 0;

  function stop() {
    const current = worker;
    worker = undefined;
    if (current) void current.terminate().catch(() => {});
    rejectJob(new AiCheckerError(503, 'Model şu anda kullanılamıyor. Birazdan tekrar dene.'));
  }

  function rejectJob(error: AiCheckerError) {
    if (!pending) return;
    clearTimeout(pending.timer);
    const { reject } = pending;
    pending = undefined;
    reject(error);
  }

  function warm() {
    if (worker) return worker;
    const current = new Worker(resolve('src/server/aiCheckerInference.mjs'), {
      workerData: { assetRoot: resolve('server/ai-checker-assets') },
    });
    worker = current;
    current.on('message', ({ type, id, result }) => {
      if (worker !== current) return;
      if (type === 'unavailable') return stop();
      if (!pending || pending.id !== id) return;
      if (type !== 'result') {
        return rejectJob(new AiCheckerError(503, 'Metin analiz edilemedi. Tekrar dene.'));
      }
      const job = pending;
      pending = undefined;
      clearTimeout(job.timer);
      job.resolve(result);
    });
    const handleExit = () => { if (worker === current) stop(); };
    current.on('error', handleExit);
    current.on('exit', handleExit);
    current.unref();
    return current;
  }

  function analyze(text: string): Promise<AiCheckerResult> {
    if (pending) throw new AiCheckerError(429, 'Model başka bir metni işliyor. Birkaç saniye sonra tekrar dene.');
    const current = warm();
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = setTimeout(() => {
        rejectJob(new AiCheckerError(504, 'Analiz zamanında tamamlanmadı. Tekrar dene.'));
        stop();
      }, 8000);
      pending = { id, resolve, reject, timer };
      try {
        current.postMessage({ id, text });
      } catch {
        stop();
      }
    });
  }

  return { warm, analyze, stop };
}
