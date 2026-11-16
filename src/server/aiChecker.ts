import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

export const AI_CHECKER_PATH = '/api/ai-checker/analyze';
export const AI_CHECKER_JOBS_PATH = '/api/ai-checker/jobs';
export type AiCheckerResult = { scores: number[]; tokens: number; truncated: boolean };
type JobState = 'queued' | 'processing' | 'done' | 'error';
type Job = {
  id: string;
  owner: string;
  state: JobState;
  text?: string; // RAM only; removed as soon as the worker receives it
  result?: AiCheckerResult;
  error?: string;
  updatedAt: number;
  timeout?: ReturnType<typeof setTimeout>;
  resolve?: (result: AiCheckerResult) => void;
  reject?: (error: AiCheckerError) => void;
};
const RESULT_TTL_MS = 10 * 60 * 1000;
const TASK_TIMEOUT_MS = 60 * 1000;
const MAX_QUEUE = 6;

export class AiCheckerError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function createAiChecker() {
  let worker: Worker | undefined;
  const jobs = new Map<string, Job>();
  const queue: Job[] = [];
  let active: Job | undefined;

  function prune() {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if ((job.state === 'done' || job.state === 'error') && now - job.updatedAt > RESULT_TTL_MS) jobs.delete(id);
    }
    // Bound memory even during sustained traffic. Only completed jobs are evicted.
    if (jobs.size > 80) {
      for (const [id, job] of jobs) {
        if (jobs.size <= 60) break;
        if (job.state === 'done' || job.state === 'error') jobs.delete(id);
      }
    }
  }

  function fail(job: Job, error: AiCheckerError) {
    if (job.timeout) clearTimeout(job.timeout);
    job.timeout = undefined;
    job.text = undefined;
    job.state = 'error';
    job.error = error.message;
    job.updatedAt = Date.now();
    job.reject?.(error);
    job.resolve = undefined;
    job.reject = undefined;
  }

  function stop() {
    const previous = worker;
    worker = undefined;
    if (previous) void previous.terminate().catch(() => {});
    const error = new AiCheckerError(503, 'Analiz servisi şu anda kullanılamıyor. Yeniden deneyin.');
    if (active) fail(active, error);
    active = undefined;
    for (const job of queue.splice(0)) fail(job, error);
  }

  function complete(id: string, result?: AiCheckerResult) {
    if (!active || active.id !== id) return;
    const job = active;
    active = undefined;
    if (job.timeout) clearTimeout(job.timeout);
    job.timeout = undefined;
    job.text = undefined;
    job.updatedAt = Date.now();
    if (result && Array.isArray(result.scores) && result.scores.length === 2
      && result.scores.every(v => Number.isFinite(v) && v >= 0 && v <= 1)
      && Number.isInteger(result.tokens) && result.tokens > 0 && typeof result.truncated === 'boolean') {
      job.state = 'done';
      job.result = result;
      job.resolve?.(result);
    } else {
      fail(job, new AiCheckerError(503, 'Metin analiz edilemedi. Yeniden deneyin.'));
    }
    job.resolve = undefined;
    job.reject = undefined;
    pump();
  }

  function warm() {
    if (worker) return worker;
    const current = new Worker(resolve('src/server/aiCheckerInference.mjs'), {
      workerData: { modelRoot: resolve(process.env.AI_DETECTOR_MODEL_DIR || 'models/ai-detector') },
    });
    worker = current;
    current.on('message', ({ type, id, result }: { type: string; id?: string; result?: AiCheckerResult }) => {
      if (worker !== current) return;
      if (type === 'unavailable') { stop(); return; }
      if (type === 'result') complete(id || '', result);
      if (type === 'error') complete(id || '');
    });
    const onExit = () => { if (worker === current) stop(); };
    current.on('error', onExit);
    current.on('exit', onExit);
    current.unref();
    return current;
  }

  function pump() {
    if (active || !queue.length) return;
    let current: Worker;
    try { current = warm(); }
    catch { stop(); return; }
    const job = queue.shift()!;
    active = job;
    job.state = 'processing';
    job.updatedAt = Date.now();
    job.timeout = setTimeout(() => {
      if (active === job) stop();
    }, TASK_TIMEOUT_MS);
    try {
      current.postMessage({ id: job.id, text: job.text });
      job.text = undefined; // no raw text is held in the job registry during inference
    } catch {
      stop();
    }
  }

  function start(owner: string, text: string) {
    prune();
    if (queue.length >= MAX_QUEUE) throw new AiCheckerError(429, 'Analiz sırası dolu. Birazdan yeniden deneyin.');
    if ([...jobs.values()].some(job => job.owner === owner && (job.state === 'queued' || job.state === 'processing'))) {
      throw new AiCheckerError(409, 'Bu hesap için zaten devam eden bir analiz var.');
    }
    const job: Job = { id: randomUUID(), owner, state: 'queued', text, updatedAt: Date.now() };
    jobs.set(job.id, job);
    queue.push(job);
    pump();
    return job.id;
  }

  function status(owner: string, id: string) {
    prune();
    const job = jobs.get(id);
    if (!job || job.owner !== owner) return null;
    if (job.state === 'done') return { status: 'done' as const, result: job.result };
    if (job.state === 'error') return { status: 'error' as const, error: job.error };
    return { status: job.state };
  }

  // Retained for previously cached clients and existing tests. New clients use jobs.
  function analyze(text: string): Promise<AiCheckerResult> {
    const owner = 'legacy:' + randomUUID();
    const id = start(owner, text);
    const job = jobs.get(id)!;
    return new Promise<AiCheckerResult>((resolve, reject) => {
      if (job.state === 'done' && job.result) return resolve(job.result);
      if (job.state === 'error') return reject(new AiCheckerError(503, job.error || 'Analiz başarısız.'));
      job.resolve = resolve;
      job.reject = reject;
    });
  }

  return { warm, start, status, analyze, stop };
}
