import { randomUUID } from 'node:crypto';
import { Agent as HttpAgent, request as httpRequest } from 'node:http';
import {
  AI_RESULT_TTL_MS, AI_TEXT_LIMIT, DESKLIB_MODEL, DESKLIB_REVISION, parseDetectorResult, type DetectorResult,
} from '../utils/aiDetectorAssessment';

export const AI_CHECKER_PATH = '/api/ai-checker/analyze';
export const AI_CHECKER_JOBS_PATH = '/api/ai-checker/jobs';
export type AiCheckerResult = DetectorResult;

type JobStatus =
  | { status: 'queued' | 'processing' }
  | { status: 'done'; result: DetectorResult; expiresAt: number }
  | { status: 'error'; error: string; expiresAt: number };
type Job = {
  id: string;
  owner: string;
  state: JobStatus;
  text?: string;
  queuedUntil: number;
  deadline: ReturnType<typeof setTimeout>;
  settle?: (value: DetectorResult | AiCheckerError) => void;
};

const BASE_INFERENCE_MS = 90_000;
const MAX_INFERENCE_MS = 480_000;
const QUEUE_MS = 10 * 60_000;
const MAX_QUEUE = 6;
const MAX_RESULTS = 80;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 4;

export class AiCheckerError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

type LocalRequest = (port: number, path: string, signal: AbortSignal, body?: string) =>
  Promise<{ status: number; data?: unknown }>;

const loopbackAgent = new HttpAgent({ keepAlive: true, maxSockets: 4, maxFreeSockets: 2, keepAliveMsecs: 10_000 });

const requestLocal: LocalRequest = (port, path, signal, body) => new Promise((resolve, reject) => {
  const req = httpRequest({
    host: '127.0.0.1', port, path, signal, agent: loopbackAgent,
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
    },
  }, response => {
    const status = response.statusCode ?? 503;
    if (status !== 200) {
      response.destroy();
      resolve({ status });
      return;
    }
    response.setEncoding('utf8');
    let data = '';
    response.on('error', reject);
    response.on('data', (chunk: string) => {
      data += chunk;
      if (data.length > 4096) req.destroy(new Error('Invalid Desklib response'));
    });
    response.on('end', () => {
      try { resolve({ status, data: JSON.parse(data) }); }
      catch { reject(new Error('Invalid Desklib response')); }
    });
  });
  req.on('error', reject);
  req.end(body);
});

export function createAiChecker({ request = requestLocal, onResult }: {
  request?: LocalRequest;
  onResult?: (owner: string, expiresAt: number) => Promise<void>;
} = {}) {
  const port = Number(process.env.DESKLIB_PORT || 8765);
  const jobs = new Map<string, Job>();
  const queue: Job[] = [];
  const rates = new Map<string, { count: number; expiresAt: number }>();
  let active: { job: Job; controller: AbortController } | undefined;

  function unavailable() {
    return new AiCheckerError(503, 'Desklib şu anda kullanılamıyor. Birazdan yeniden dene.');
  }

  function prune(now = Date.now()) {
    const terminal = [...jobs.values()].filter(job => 'expiresAt' in job.state);
    for (const [index, job] of terminal.entries()) {
      if ('expiresAt' in job.state && (job.state.expiresAt <= now || index < terminal.length - MAX_RESULTS)) {
        clearTimeout(job.deadline);
        jobs.delete(job.id);
      }
    }
    for (const [owner, limit] of rates) if (limit.expiresAt <= now) rates.delete(owner);
  }

  function finish(job: Job, outcome: DetectorResult | AiCheckerError) {
    clearTimeout(job.deadline);
    job.text = undefined;
    const expiresAt = Date.now() + AI_RESULT_TTL_MS;
    job.state = outcome instanceof AiCheckerError
      ? { status: 'error', error: outcome.message, expiresAt }
      : { status: 'done', result: outcome, expiresAt };
    job.deadline = setTimeout(() => jobs.delete(job.id), AI_RESULT_TTL_MS);
    job.deadline.unref();
    job.settle?.(outcome);
    job.settle = undefined;
    if (!(outcome instanceof AiCheckerError) && outcome.scores && onResult) {
      void Promise.resolve().then(() => onResult(job.owner, expiresAt)).catch(() => {
        console.warn('Desklib completion notification failed');
      });
    }
    prune();
  }

  async function pump() {
    if (active || !queue.length) return;
    const job = queue.shift()!;
    clearTimeout(job.deadline);
    if (job.queuedUntil <= Date.now()) {
      finish(job, new AiCheckerError(504, 'Analiz sırasının süresi doldu. Yeniden dene.'));
      void pump();
      return;
    }
    const controller = new AbortController();
    active = { job, controller };
    job.state = { status: 'processing' };
    // Budget for slower VDS CPUs and denser inputs without changing the single-worker limit.
    const textLength = job.text!.length;
    const inferenceMs = Math.min(MAX_INFERENCE_MS, BASE_INFERENCE_MS + textLength * 8);
    job.deadline = setTimeout(() => controller.abort(), inferenceMs);
    try {
      const body = JSON.stringify({ text: job.text });
      job.text = undefined;
      const response = await request(port, '/infer', controller.signal, body);
      if (response.status !== 200) {
        if (response.status === 429) throw new AiCheckerError(503, 'Model önceki analizi bitiriyor. Birazdan yeniden dene.');
        if (response.status === 413) throw new AiCheckerError(413, 'Metin analiz servisinin istek sınırını aşıyor.');
        if (response.status === 400 && textLength > 20_000) {
          throw new AiCheckerError(503, 'Desklib bu uzunluktaki metni kabul etmedi. Desklib servisinin güncel olduğunu kontrol et.');
        }
        throw unavailable();
      }
      const result = parseDetectorResult(response.data);
      if (!result) throw unavailable();
      if (active?.job === job) finish(job, result);
    } catch (error) {
      if (active?.job === job) finish(job, controller.signal.aborted
        ? new AiCheckerError(504, 'Analiz zaman aşımına uğradı. Daha kısa bir metinle yeniden dene.')
        : error instanceof AiCheckerError ? error : unavailable());
    } finally {
      if (active?.job === job) active = undefined;
      void pump();
    }
  }

  function start(owner: string, text: string, settle?: Job['settle']) {
    const now = Date.now();
    prune(now);
    if (!text.trim() || text.length > AI_TEXT_LIMIT) throw new AiCheckerError(400, 'Geçersiz metin uzunluğu.');
    if ([...jobs.values()].some(job => job.owner === owner && !('expiresAt' in job.state))) {
      throw new AiCheckerError(409, 'Bu hesap için zaten devam eden bir analiz var.');
    }
    const rate = rates.get(owner);
    if (rate && rate.count >= RATE_LIMIT) throw new AiCheckerError(429, 'Analiz sınırına ulaştın. Bir dakika sonra yeniden dene.');
    if (queue.length >= MAX_QUEUE || (!rate && rates.size >= 1024)) {
      throw new AiCheckerError(429, 'Analiz sırası dolu. Birazdan yeniden dene.');
    }
    rates.set(owner, { count: (rate?.count ?? 0) + 1, expiresAt: rate?.expiresAt ?? now + RATE_WINDOW_MS });
    const id = randomUUID();
    const deadline = setTimeout(() => {
      const index = queue.findIndex(job => job.id === id);
      if (index < 0) return;
      const [job] = queue.splice(index, 1);
      finish(job, new AiCheckerError(504, 'Analiz sırasının süresi doldu. Yeniden dene.'));
    }, QUEUE_MS);
    const job: Job = { id, owner, state: { status: 'queued' }, text, queuedUntil: now + QUEUE_MS, deadline, settle };
    jobs.set(id, job);
    queue.push(job);
    void pump();
    return id;
  }

  function status(owner: string, id: string) {
    prune();
    const job = jobs.get(id);
    return job?.owner === owner ? job.state : null;
  }

  function latest(owner: string) {
    prune();
    const own = [...jobs.values()].filter(job => job.owner === owner);
    const last = own.at(-1);
    const completed = own.reverse().find(job => job.state.status === 'done');
    return {
      current: last && last !== completed ? { id: last.id, ...last.state } : null,
      lastResult: completed?.state.status === 'done' ? completed.state : null,
    };
  }

  function analyze(owner: string, text: string): Promise<DetectorResult> {
    return new Promise((resolve, reject) => {
      start(owner, text, outcome => outcome instanceof AiCheckerError ? reject(outcome) : resolve(outcome));
    });
  }

  async function health() {
    try {
      const response = await request(port, '/healthz', AbortSignal.timeout(1500));
      const data = response.data as { ready?: boolean; model?: string; revision?: string } | undefined;
      return response.status === 200 && data?.ready === true
        && data.model === DESKLIB_MODEL && data.revision === DESKLIB_REVISION;
    } catch { return false; }
  }

  function stop() {
    const previous = active;
    active = undefined;
    previous?.controller.abort();
    for (const job of queue.splice(0)) finish(job, unavailable());
    if (previous) finish(previous.job, unavailable());
    for (const job of jobs.values()) clearTimeout(job.deadline);
    jobs.clear();
    rates.clear();
  }

  return { start, status, latest, analyze, health, stop };
}
