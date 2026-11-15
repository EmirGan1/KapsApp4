import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainCircuit, LockKeyhole, RotateCcw } from 'lucide-react';

type Result = { scores: number[]; tokens: number; truncated: boolean };
type SavedAnalysis = { text: string; pendingId: string | null; result: Result | null };
type WorkerReply =
  | ({ type: 'result'; id: string } & Result)
  | { type: 'error'; id: string; message: string; retryable: boolean };

const EMPTY_ANALYSIS: SavedAnalysis = { text: '', pendingId: null, result: null };

function readAnalysis(storageKey: string): SavedAnalysis {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as SavedAnalysis | null;
    if (saved && typeof saved.text === 'string' && (saved.pendingId === null || typeof saved.pendingId === 'string')) {
      const result = saved.result;
      return {
        text: saved.text.slice(0, 20000),
        pendingId: saved.text.trim() ? saved.pendingId : null,
        result: Array.isArray(result?.scores) && result.scores.length === 2 && result.scores.every(Number.isFinite)
          && typeof result.tokens === 'number' && typeof result.truncated === 'boolean' ? result : null,
      };
    }
  } catch {
    // Storage can be unavailable in private mode or disabled by the browser.
  }
  return EMPTY_ANALYSIS;
}

export default function AiChecker({ account, active }: { account: string; active: boolean }) {
  const storageKey = `kapsapp.ai-checker.v1.${account}`;
  const [saved, setSaved] = useState(() => readAnalysis(storageKey));
  const [text, setText] = useState(saved.text);
  const [error, setError] = useState('');
  const [resume, setResume] = useState(0);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const savedRef = useRef(saved);
  const workerRef = useRef<Worker | null>(null);
  const runningId = useRef<string | null>(null);
  const backgroundedId = useRef<string | null>(null);
  const retriedId = useRef<string | null>(null);
  const busy = saved.pendingId !== null;
  const result = saved.result;

  const saveAnalysis = useCallback((analysis: SavedAnalysis, completedId?: string) => {
    savedRef.current = analysis;
    setSaved(analysis);
    try {
      // An older tab must not overwrite an analysis started or cleared in a newer tab.
      if (completedId && readAnalysis(storageKey).pendingId !== completedId) return;
      if (analysis === EMPTY_ANALYSIS) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(analysis));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [storageKey]);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    runningId.current = null;
  }, []);

  const handleFailure = useCallback((id: string, message: string, retryable = false) => {
    stopWorker();
    if (savedRef.current.pendingId !== id) return;
    if (backgroundedId.current === id || (retryable && retriedId.current !== id)) {
      backgroundedId.current = null;
      retriedId.current = id;
      setResume(value => value + 1);
      return;
    }
    saveAnalysis({ ...savedRef.current, pendingId: null }, id);
    setError(message);
  }, [saveAnalysis, stopWorker]);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('../workers/aiChecker.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const data = event.data;
      if (workerRef.current !== worker || data.id !== runningId.current || data.id !== savedRef.current.pendingId) return;
      if (data.type === 'error') {
        handleFailure(data.id, data.message, data.retryable);
        return;
      }
      runningId.current = null;
      backgroundedId.current = null;
      const { scores, tokens, truncated } = data;
      saveAnalysis({ ...savedRef.current, pendingId: null, result: { scores, tokens, truncated } }, data.id);
    };
    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      const id = runningId.current;
      if (id) handleFailure(id, 'Tarayıcı yerel modeli çalıştıramadı.');
      else stopWorker();
    };
    return worker;
  }, [handleFailure, saveAnalysis, stopWorker]);

  useEffect(() => {
    const markBackgrounded = () => { backgroundedId.current = runningId.current; };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markBackgrounded();
      else setResume(value => value + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', markBackgrounded);
    window.addEventListener('pageshow', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', markBackgrounded);
      window.removeEventListener('pageshow', onVisibilityChange);
      stopWorker();
    };
  }, [stopWorker]);

  useEffect(() => {
    if (!active && !saved.pendingId) {
      stopWorker();
      return;
    }
    if (document.visibilityState === 'hidden') return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'hidden') return;
      const { pendingId, text: submittedText } = savedRef.current;
      if (runningId.current || (!pendingId && (workerRef.current || error))) return;
      try {
        const worker = getWorker();
        if (pendingId) {
          runningId.current = pendingId;
          worker.postMessage({ type: 'analyze', id: pendingId, text: submittedText });
        } else {
          worker.postMessage({ type: 'preload' });
        }
      } catch {
        if (pendingId) handleFailure(pendingId, 'Tarayıcı yerel modeli çalıştıramadı.');
        else stopWorker();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, error, getWorker, handleFailure, resume, saved.pendingId, stopWorker]);

  const reset = () => {
    if (busy) stopWorker();
    backgroundedId.current = null;
    saveAnalysis(EMPTY_ANALYSIS);
    setText('');
    setError('');
  };

  const analyze = () => {
    const input = text.trim();
    if (!input || savedRef.current.pendingId) return;
    backgroundedId.current = null;
    setError('');
    saveAnalysis({ ...savedRef.current, text: input, pendingId: crypto.randomUUID() });
  };

  return (
    <main hidden={!active} className="flex-1 min-h-0 w-full max-w-3xl mx-auto overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y p-4 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500"><BrainCircuit size={25} /></div>
          <div><h1 className="text-2xl font-bold">AI Checker</h1><p className="text-sm text-slate-500 dark:text-slate-400">Tarayıcında çalışan deneysel metin analizi</p></div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-5">
          Analiz cihazında çalışır. Son gönderdiğin metin ve son sonuç bu tarayıcıda saklanır.
        </p>
        <label htmlFor="ai-checker-input" className="block text-sm font-semibold mb-2">İncelenecek metin</label>
        <textarea id="ai-checker-input" value={text} disabled={busy} onChange={event => setText(event.target.value)}
          maxLength={20000} rows={9} placeholder="Metni buraya yaz veya yapıştır..."
          className="w-full resize-y min-h-44 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-base outline-none focus:ring-2 focus:ring-indigo-500" />
        <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
          <span className="text-xs text-slate-500">{text.length.toLocaleString('tr-TR')} / 20.000 karakter</span>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="min-h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center gap-2"><RotateCcw size={16} /> Temizle</button>
            <button type="button" onClick={analyze} disabled={busy || !text.trim()} className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{busy ? 'İşleniyor…' : 'Analiz Et'}</button>
          </div>
        </div>
        {busy && <p role="status" className="sr-only">Metin işleniyor.</p>}
        {storageUnavailable && <p role="status" className="mt-4 text-sm text-slate-500">Tarayıcı depolamaya izin vermedi. Son analiz bu sayfa açıkken korunur.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-500">{error}</p>}
      </div>

      {result && <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/5 p-6" aria-live="polite">
        <h2 className="text-lg font-bold mb-3">Son analiz sonucu</h2>
        <p className="text-sm mb-4">Baskın çıktı: <strong>Sınıf {result.scores[1] > result.scores[0] ? 1 : 0}</strong>. ONNX dosyasında sınıfların “insan” ve “AI” eşlemesi bulunmadığı için bu skorlardan güvenilir bir AI hükmü çıkarılamaz.</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          {result.scores.map((score, index) => <div key={index} className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800"><div className="text-xs text-slate-500">Sınıf {index}</div><div className="text-xl font-bold tabular-nums">{(score * 100).toFixed(1)}%</div></div>)}
        </div>
        <p className="text-xs mt-4 text-slate-500">{result.tokens} token işlendi.{result.truncated ? ' Modelin 512 token sınırı nedeniyle metnin devamı işlenmedi.' : ''} Skorlar doğruluk oranı değildir; özellikle kısa metinlerde sonuçları kesin kanıt sayma.</p>
      </section>}

      <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400"><LockKeyhole size={16} className="shrink-0" /><span>Metin sunucuya gönderilmez. Bu tarayıcıdaki metni ve sonucu silmek için Temizle’ye bas.</span></div>
    </main>
  );
}
