import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, LockKeyhole, RotateCcw } from 'lucide-react';

type Result = { scores: number[]; tokens: number; truncated: boolean };
type WorkerReply =
  | { type: 'progress'; stage: 'runtime' | 'model' | 'initializing'; done: number; total: number }
  | { type: 'result'; id: number; scores: number[]; tokens: number; truncated: boolean }
  | { type: 'error'; id: number; message: string };

export default function AiChecker() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);

  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);

  const reset = () => {
    requestId.current++;
    workerRef.current?.terminate();
    workerRef.current = null;
    setText(''); setResult(null); setError(''); setProgress(''); setBusy(false);
  };

  const analyze = () => {
    if (!text.trim() || busy) return;
    setResult(null); setError(''); setBusy(true);
    const worker = workerRef.current || new Worker(new URL('../workers/aiChecker.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const id = ++requestId.current;
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const data = event.data;
      if (data.type === 'progress') {
        const stage = data.stage === 'runtime' ? 'Çalıştırıcı' : data.stage === 'model' ? 'Model' : 'Model hazırlanıyor';
        setProgress(data.stage === 'initializing' ? stage : `${stage} indiriliyor: ${data.done}/${data.total}`);
      } else if (data.id === requestId.current && data.type === 'result') {
        setResult(data); setBusy(false); setProgress('');
      } else if (data.id === requestId.current && data.type === 'error') {
        setError(data.message); setBusy(false); setProgress('');
        worker.terminate(); workerRef.current = null;
      }
    };
    worker.onerror = () => {
      setError('Tarayıcı model işçisini çalıştıramadı. Bellek veya tarayıcı desteğini kontrol edin.');
      setBusy(false); setProgress(''); worker.terminate(); workerRef.current = null;
    };
    worker.postMessage({ id, text: text.trim() });
  };

  return (
    <main className="w-full max-w-3xl mx-auto p-4 sm:p-8 pb-28 space-y-6 text-slate-900 dark:text-slate-100">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500"><BrainCircuit size={25} /></div>
          <div><h1 className="text-2xl font-bold">AI Checker</h1><p className="text-sm text-slate-500 dark:text-slate-400">Tarayıcında çalışan deneysel metin analizi</p></div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-5">
          Metni buraya yapıştır. Model yalnızca Analiz Et dediğinde cihazına indirilir; metin sunucuya gönderilmez ve KapsApp tarafından kaydedilmez.
          İlk kullanımda yaklaşık 111 MB model ve çalıştırıcı indirilir, işlem cihazının belleğinde yapılır.
        </p>
        <label htmlFor="ai-checker-input" className="block text-sm font-semibold mb-2">İncelenecek metin</label>
        <textarea id="ai-checker-input" value={text} disabled={busy} onChange={event => { setText(event.target.value); setResult(null); }}
          maxLength={20000} rows={9} placeholder="Metni buraya yaz veya yapıştır..."
          className="w-full resize-y min-h-44 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-base outline-none focus:ring-2 focus:ring-indigo-500" />
        <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
          <span className="text-xs text-slate-500">{text.length.toLocaleString('tr-TR')} / 20.000 karakter</span>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="min-h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center gap-2"><RotateCcw size={16} /> Temizle</button>
            <button type="button" onClick={analyze} disabled={busy || !text.trim()} className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{busy ? 'İşleniyor…' : 'Analiz Et'}</button>
          </div>
        </div>
        {progress && <p role="status" className="mt-4 text-sm text-indigo-500">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-500">{error}</p>}
      </div>

      {result && <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/5 p-6" aria-live="polite">
        <h2 className="text-lg font-bold mb-3">Model çıktısı</h2>
        <p className="text-sm mb-4">Baskın çıktı: <strong>Sınıf {result.scores[1] > result.scores[0] ? 1 : 0}</strong>. ONNX dosyasında sınıfların “insan” ve “AI” eşlemesi bulunmadığı için bu skorlardan güvenilir bir AI hükmü çıkarılamaz.</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          {result.scores.map((score, index) => <div key={index} className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800"><div className="text-xs text-slate-500">Sınıf {index}</div><div className="text-xl font-bold tabular-nums">{(score * 100).toFixed(1)}%</div></div>)}
        </div>
        <p className="text-xs mt-4 text-slate-500">{result.tokens} token işlendi.{result.truncated ? ' Modelin 512 token sınırı nedeniyle metnin devamı işlenmedi.' : ''} Skorlar doğruluk oranı değildir; özellikle kısa metinlerde sonuçları kesin kanıt sayma.</p>
      </section>}

      <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400"><LockKeyhole size={16} className="shrink-0" /><span>Analiz girdisi API, veritabanı, localStorage veya tarayıcı önbelleğine yazılmaz. Sekmeyi kapattığında bellekteki analiz sona erer.</span></div>
    </main>
  );
}
