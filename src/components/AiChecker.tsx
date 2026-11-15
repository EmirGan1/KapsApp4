import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, LockKeyhole, RotateCcw } from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../utils/api';

type Result = { scores: number[]; tokens: number; truncated: boolean };
const STORAGE_PREFIX = 'kapsapp.ai-checker.v1.';

function isResult(value: unknown): value is Result {
  const result = value as Result | null;
  return Array.isArray(result?.scores) && result.scores.length === 2
    && result.scores.every(Number.isFinite) && typeof result.tokens === 'number'
    && typeof result.truncated === 'boolean';
}

export function clearLegacyAiCheckerData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      let value;
      try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
      const result = isResult(value) ? value : value?.result;
      if (isResult(result)) {
        const { scores, tokens, truncated } = result;
        localStorage.setItem(key, JSON.stringify({ scores, tokens, truncated }));
      } else {
        localStorage.removeItem(key);
      }
    }
  } catch {}
  void globalThis.caches?.delete('kapsapp-ai-checker-4c66198').catch(() => {});
}

export default function AiChecker({ account, active }: { account: string; active: boolean }) {
  const storageKey = `${STORAGE_PREFIX}${account}`;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (isResult(stored)) return stored;
      if (isResult(stored?.result)) return stored.result;
    } catch {}
    return null;
  });
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const reset = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setText('');
    setResult(null);
    setError('');
    setBusy(false);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const analyze = async () => {
    const input = text.trim();
    if (!input || requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setBusy(true);
    setError('');
    const timeout = window.setTimeout(() => request.abort(), 11000);
    try {
      const response = await fetch(getApiUrl('/api/ai-checker/analyze'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        cache: 'no-store',
        body: JSON.stringify({ text: input }),
        signal: request.signal,
      });
      const data = await response.json().catch(() => null);
      if (requestRef.current !== request) return;
      if (!response.ok || !isResult(data)) {
        setError(typeof data?.error === 'string' ? data.error : 'Analiz şu anda kullanılamıyor. Tekrar dene.');
        return;
      }
      const { scores, tokens, truncated } = data;
      const summary = { scores, tokens, truncated };
      setResult(summary);
      try { localStorage.setItem(storageKey, JSON.stringify(summary)); } catch {}
    } catch {
      if (requestRef.current === request) {
        setError(request.signal.aborted ? 'Analiz zamanında tamamlanmadı. Tekrar dene.' : 'Sunucu bağlantısı kesildi. Tekrar dene.');
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === request) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <main hidden={!active} className="flex-1 min-h-0 w-full max-w-3xl mx-auto overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y p-4 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500"><BrainCircuit size={25} /></div>
          <div><h1 className="text-2xl font-bold">AI Checker</h1><p className="text-sm text-slate-500 dark:text-slate-400">Tarayıcında çalışan deneysel metin analizi</p></div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-5">
          Model KapsApp’te hazır. Metnini yazıp doğrudan analiz edebilirsin.
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

      <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400"><LockKeyhole size={16} className="shrink-0" /><span>Metin yalnızca analiz için sunucunun belleğinde işlenir. Bu tarayıcıda yalnızca son sonuç saklanır.</span></div>
    </main>
  );
}
