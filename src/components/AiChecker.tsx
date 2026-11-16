import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, BrainCircuit, Check, ClipboardPaste, Copy,
  FileText, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../utils/api';
import { assessAiDetectorResult, type DetectorResult } from '../utils/aiDetectorAssessment';

type Result = DetectorResult;
type JobResponse =
  | { status: 'queued' | 'processing' }
  | { status: 'done'; result: Result }
  | { status: 'error'; error?: string };

const STORAGE_PREFIX = 'kapsapp.ai-checker.v3.';
const PREVIOUS_PREFIX = 'kapsapp.ai-checker.v2.';
const LEGACY_PREFIX = 'kapsapp.ai-checker.v1.';
const JOB_PREFIX = 'kapsapp.ai-checker.job.v1.';
const MAX_LENGTH = 20_000;

function isResult(value: unknown): value is Result {
  const r = value as Result | null;
  return !!r && Array.isArray(r.scores) && r.scores.length === 2
    && r.scores.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    && typeof r.tokens === 'number' && Number.isFinite(r.tokens)
    && typeof r.truncated === 'boolean'
    && (r.words === undefined || (Number.isInteger(r.words) && r.words >= 0))
    && (r.segmentAi === undefined || (Array.isArray(r.segmentAi) && r.segmentAi.length > 0
      && r.segmentAi.length <= 3 && r.segmentAi.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)));
}
function percent(n: number) { return (n * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }); }
function readResult(key: string): Result | null {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (isResult(data)) return data;
    if (isResult(data?.result)) return data.result;
  } catch {}
  return null;
}
function readJob(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value && /^[a-f0-9-]{36}$/i.test(value) ? value : null;
  } catch { return null; }
}

export function clearLegacyAiCheckerData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(LEGACY_PREFIX) || key.startsWith(PREVIOUS_PREFIX)) {
        // Old model scores may have a different label order; never relabel them.
        localStorage.removeItem(key);
        continue;
      }
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      const result = readResult(key);
      if (result) localStorage.setItem(key, JSON.stringify(result));
      else localStorage.removeItem(key);
    }
  } catch {}
  void globalThis.caches?.delete('kapsapp-ai-checker-4c66198').catch(() => {});
}

export default function AiChecker({ account, active }: { account: string; active: boolean }) {
  const resultKey = `${STORAGE_PREFIX}${account}`;
  const jobKey = `${JOB_PREFIX}${account}`;
  // Never persist submitted text. Only numeric results and an opaque temporary job ID are stored.
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(() => readResult(resultKey));
  const [jobId, setJobId] = useState<string | null>(() => readJob(jobKey));
  const [phase, setPhase] = useState<'queued' | 'processing'>('queued');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasting, setPasting] = useState(false);
  const wordCount = useMemo(() => text.trim().match(/\S+/g)?.length || 0, [text]);
  const busy = submitting || Boolean(jobId);

  useEffect(() => {
    if (!jobId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const finish = () => {
      if (disposed) return;
      setJobId(null);
      try { localStorage.removeItem(jobKey); } catch {}
    };
    const poll = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(getApiUrl(`/api/ai-checker/jobs/${jobId}`), {
          headers: getAuthHeaders(),
          cache: 'no-store',
          signal: controller.signal,
        });
        const data: JobResponse & { error?: string } = await response.json().catch(() => ({ status: 'error' }));
        if (disposed) return;
        if (!response.ok) {
          setError(data.error || 'Analiz oturumu bulunamadı. Yeniden analiz edebilirsin.');
          finish();
          return;
        }
        if (data.status === 'done' && isResult(data.result)) {
          const summary: Result = {
            scores: data.result.scores,
            tokens: data.result.tokens,
            truncated: data.result.truncated,
            words: data.result.words,
            segmentAi: data.result.segmentAi,
            language: data.result.language,
          };
          setResult(summary);
          try { localStorage.setItem(resultKey, JSON.stringify(summary)); } catch {}
          setError('');
          finish();
          return;
        }
        if (data.status === 'error') {
          setError(data.error || 'Analiz tamamlanamadı. Tekrar dene.');
          finish();
          return;
        }
        setPhase(data.status === 'processing' ? 'processing' : 'queued');
      } catch {
        if (disposed) return;
        setPhase('queued');
        // Temporary network loss should not cancel the server-side job.
      }
      if (!disposed) timer = setTimeout(poll, 1750);
    };
    void poll();
    return () => { disposed = true; if (timer) clearTimeout(timer); controller?.abort(); };
  }, [jobId, jobKey, resultKey]);

  const analyze = async () => {
    const input = text.trim();
    if (!input || busy || input.length > MAX_LENGTH) return;
    setSubmitting(true);
    setError('');
    setPhase('queued');
    try {
      const response = await fetch(getApiUrl('/api/ai-checker/jobs'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        cache: 'no-store',
        body: JSON.stringify({ text: input }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.id !== 'string') {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Analiz başlatılamadı. Tekrar dene.');
      }
      try { localStorage.setItem(jobKey, data.id); } catch {}
      setJobId(data.id);
      // Keep the draft only in this tab's memory so a failed request can be retried.
      // It is never written to localStorage, sessionStorage, a URL, or the server database.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bağlantı kurulamadı. Tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setText('');
    setResult(null);
    setError('');
    setJobId(null);
    try {
      localStorage.removeItem(resultKey);
      localStorage.removeItem(jobKey);
    } catch {}
  };

  const paste = async () => {
    setPasting(true);
    setError('');
    try {
      const value = await navigator.clipboard.readText();
      setText(value.slice(0, MAX_LENGTH));
    } catch {
      setError('Panoya erişilemedi. Metni kutuya elle yapıştırabilirsin.');
    } finally { setPasting(false); }
  };

  const copy = async () => {
    if (!result) return;
    const assessment = assessAiDetectorResult(result);
    const summary = `KapsApp AI Metin Dedektörü\nDeğerlendirme: ${assessment.title}\n${assessment.detail}\nHam İnsan modeli skoru: %${percent(result.scores[0])}\nHam AI modeli skoru: %${percent(result.scores[1])}\nSkorlar doğruluk oranı veya yazarlık kanıtı değildir.`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { setError('Sonuç kopyalanamadı.'); }
  };

  const human = result?.scores[0] || 0;
  const ai = result?.scores[1] || 0;
  const assessment = result ? assessAiDetectorResult(result) : null;
  const isTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(text);

  return (
    <main hidden={!active} className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-[calc(env(safe-area-inset-bottom)+6rem)] space-y-5">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-indigo-600 dark:text-indigo-300">
            <BrainCircuit size={16} /> KapsApp · Akademik Araçlar
          </div>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <BrainCircuit size={26} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Metin Dedektörü</h1>
              <p className="mt-1 text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                Modelin sınırlı dil sinyallerini incele; kesin yazarlık hükmü değil.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400"/> Metin kaydedilmez</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole size={15}/> Sunucuda yerel model</span>
            <span className="inline-flex items-center gap-1.5"><FileText size={15}/> İngilizce odaklı</span>
          </div>
        </header>

        <section className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-4 pt-5 sm:px-6 sm:pt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base">Metnini analiz et</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Metni yapıştır, analiz et, sonucu hemen gör.</p>
            </div>
            <button type="button" onClick={paste} disabled={busy || pasting}
              className="inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              <ClipboardPaste size={16}/>{pasting ? 'Okunuyor…' : 'Panodan yapıştır'}
            </button>
          </div>
          <div className="px-4 pt-4 sm:px-6">
            <label htmlFor="ai-checker-input" className="sr-only">Analiz edilecek metin</label>
            <textarea id="ai-checker-input" value={text} maxLength={MAX_LENGTH} disabled={busy}
              onChange={event => setText(event.target.value)}
              onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void analyze(); } }}
              rows={9} spellCheck={false}
              placeholder="Analiz etmek istediğin İngilizce metni buraya yaz veya yapıştır…"
              className="block w-full min-h-52 sm:min-h-64 resize-y rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/70 p-4 sm:p-5 text-base leading-7 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60"/>
            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>{wordCount.toLocaleString('tr-TR')} kelime · {text.length.toLocaleString('tr-TR')} / {MAX_LENGTH.toLocaleString('tr-TR')} karakter</span>
              <span className="hidden sm:inline">Ctrl / ⌘ + Enter ile analiz et</span>
            </div>
            {isTurkish && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Bu model İngilizce için eğitildi. Türkçe metinlerde sonuçlar daha az güvenilir olabilir.</p>}
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6">
            <button type="button" onClick={reset} disabled={busy}
              className="inline-flex justify-center items-center gap-2 min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              <RotateCcw size={16}/> Temizle
            </button>
            <button type="button" onClick={() => void analyze()} disabled={busy || !text.trim()}
              className="inline-flex justify-center items-center gap-2 min-h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {busy ? <><LoaderCircle size={18} className="animate-spin"/> Analiz sürüyor…</> : <>Metni analiz et <ArrowRight size={18}/></>}
            </button>
          </div>
        </section>

        {busy && <section role="status" aria-live="polite" className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 sm:p-5 flex items-start gap-3">
          <LoaderCircle size={20} className="mt-0.5 text-indigo-600 dark:text-indigo-300 animate-spin shrink-0"/>
          <div className="min-w-0 space-y-1">
            <h2 className="font-semibold text-sm">{submitting || phase === 'queued' ? 'Analiz sıraya alınıyor' : 'Metnin inceleniyor'}</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Model sunucuda çalışıyor. Başka bir bölüme geçsen veya bu ekranı kapatsan da işlem sunucuda devam eder. Döndüğünde sonucu kontrol edebilirsin.
            </p>
          </div>
        </section>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"><AlertCircle size={18} className="shrink-0"/>{error}</div>}

        {result && <section aria-live="polite" className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-7 space-y-5">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{busy ? 'Önceki analiz' : 'Son analiz sonucu'}</p>
                <h2 className="text-xl sm:text-2xl font-bold mt-1">
                  {assessment?.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{assessment?.detail}</p>
              </div>
              <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Kopyalandı' : 'Sonucu kopyala'}
              </button>
            </div>
            <details className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-200">Teknik model skorlarını göster (doğruluk yüzdesi değil)</summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                { name: 'İnsan skoru', value: human, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
                { name: 'AI skoru', value: ai, bar: 'bg-indigo-500', dot: 'bg-indigo-500' },
              ].map(item => <div key={item.name} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-950/40">
                <div className="flex justify-between items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold"><span className={`w-2.5 h-2.5 rounded-full ${item.dot}`}/>{item.name}</span>
                  <span className="text-2xl font-bold tabular-nums">%{percent(item.value)}</span>
                </div>
                <div className="mt-4 rounded-full h-2.5 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full transition-[width] duration-500 ${item.bar}`} style={{ width: `${item.value * 100}%` }}/>
                </div>
              </div>)}
            </div>
            </details>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed space-y-2">
              <p>{result.words?.toLocaleString('tr-TR') || '—'} kelime · {result.tokens} token · {result.segmentAi?.length || 1} ayrı metin bölümü değerlendirildi.{result.truncated ? ' Uzun metnin bir kısmı örneklendi.' : ''}</p>
              <p>Model İngilizce için eğitilmiştir. Kısa, düzenlenmiş ve İngilizce dışındaki metinlerde yanlış pozitifler görülebilir. Ayrı bölümlerde aynı skorun çıkması da yazarlığı kanıtlamaz.</p>
            </div>
          </div>
        </section>}

        <div className="flex gap-3 rounded-2xl p-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          <LockKeyhole size={19} className="shrink-0 mt-0.5"/>
          <p>Yazdığın metin analiz sırasında sunucunun belleğinde işlenir, veritabanına kaydedilmez. Bu cihazda yalnızca sonucun sayısal özeti ve varsa geçici analiz kimliği tutulur.</p>
        </div>
      </div>
    </main>
  );
}
