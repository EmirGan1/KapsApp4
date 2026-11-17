import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, BrainCircuit, Check, ClipboardPaste, Copy,
  FileText, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '../utils/api';
import { AI_TEXT_LIMIT as MAX_LENGTH, assessAiDetectorResult, parseDetectorResult, type DetectorResult } from '../utils/aiDetectorAssessment';

const JOBS = '/api/ai-checker/jobs';

function percent(n: number) { return (n * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }); }

export function clearLegacyAiCheckerData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('kapsapp.ai-checker.')) localStorage.removeItem(key);
    }
  } catch {}
  void globalThis.caches?.delete('kapsapp-ai-checker-4c66198').catch(() => {});
}

export default function AiChecker({ active }: { active: boolean }) {
  const [text, setText] = useState('');
  const [last, setLast] = useState<{ result: DetectorResult; expiresAt: number } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'queued' | 'processing'>('queued');
  const [restoring, setRestoring] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasting, setPasting] = useState(false);
  const submittingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wordCount = useMemo(() => text.trim().match(/\S+/g)?.length || 0, [text]);
  const busy = submitting || Boolean(jobId);
  const result = last?.result;

  useEffect(() => {
    if (!last) return;
    const timer = setTimeout(() => setLast(null), Math.max(0, last.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [last]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 6000);
      try {
        const response = await fetch(getApiUrl(jobId ? `${JOBS}/${jobId}?model=desklib` : JOBS), {
          headers: getAuthHeaders(), cache: 'no-store', signal: request.signal,
        });
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted || submittingRef.current) return;
        if (response.status >= 500) throw new Error();
        if (!response.ok) {
          setError(data?.error || 'Analiz oturumu bulunamadı.');
          setJobId(null);
          return;
        }
        const state = jobId ? data : data?.current;
        const completed = jobId && state?.status === 'done' ? state : data?.lastResult;
        if (completed) {
          const summary = parseDetectorResult(completed.result);
          if (summary && Number.isFinite(completed.expiresAt) && completed.expiresAt > Date.now()) {
            setLast({ result: summary, expiresAt: completed.expiresAt });
          } else if (jobId) {
            setError('Analiz sonucu doğrulanamadı. Yeniden dene.');
          }
        } else if (!jobId) setLast(null);

        if (state?.status === 'queued' || state?.status === 'processing') {
          setPhase(state.status);
          setError('');
          if (!jobId) setJobId(state.id);
          else timer = setTimeout(poll, 750);
          return;
        }
        if (state?.status === 'error') setError(state.error || 'Analiz tamamlanamadı. Yeniden dene.');
        if (jobId) setJobId(null);
      } catch {
        if (controller.signal.aborted) return;
        if (jobId) {
          setError('Bağlantı kesildi. Analiz durumu yeniden kontrol ediliyor.');
          timer = setTimeout(poll, 2500);
        }
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', abort);
        if (!controller.signal.aborted) setRestoring(false);
      }
    };

    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [active, jobId]);

  const analyze = async () => {
    const input = text.trim();
    if (!input || busy || restoring || submittingRef.current || input.length > MAX_LENGTH) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setPhase('queued');
    try {
      const response = await fetch(getApiUrl(JOBS), {
        method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), cache: 'no-store',
        body: JSON.stringify({ text: input }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.id !== 'string') {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Analiz başlatılamadı. Tekrar dene.');
      }
      setJobId(data.id);
      setText('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bağlantı kurulamadı. Tekrar dene.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const reset = () => {
    setText('');
    setError('');
    inputRef.current?.focus();
  };

  const paste = async () => {
    setPasting(true);
    setError('');
    try {
      const value = await navigator.clipboard.readText();
      setText(value.slice(0, MAX_LENGTH));
    } catch {
      inputRef.current?.focus();
      setError('Panoya erişilemedi. Metni kutuya elle yapıştırabilirsin.');
    } finally { setPasting(false); }
  };

  const copy = async () => {
    if (!result) return;
    const assessment = assessAiDetectorResult(result);
    const scores = result.scores
      ? `\nİnsan Yazımı: %${percent(result.scores[0])}\nAI Üretimi: %${percent(result.scores[1])}\nBunlar model skorlarıdır.` : '';
    const summary = `KapsApp AI Metin Dedektörü\n${assessment.title}\n${assessment.detail}${scores}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { setError('Sonuç kopyalanamadı.'); }
  };

  const human = result?.scores?.[0] ?? 0;
  const ai = result?.scores?.[1] ?? 0;
  const assessment = result ? assessAiDetectorResult(result) : null;

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
            <span className="inline-flex items-center gap-1.5"><FileText size={15}/> Türkçe ve İngilizce</span>
          </div>
        </header>

        <section className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-4 pt-5 sm:px-6 sm:pt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base">Metnini analiz et</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Türkçe için en az 60, İngilizce için en az 120 kelime kullan. Dil otomatik algılanır.</p>
            </div>
            <button type="button" onClick={paste} disabled={busy || pasting}
              className="inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              <ClipboardPaste size={16}/>{pasting ? 'Okunuyor…' : 'Panodan yapıştır'}
            </button>
          </div>
          <div className="px-4 pt-4 sm:px-6">
            <label htmlFor="ai-checker-input" className="sr-only">Analiz edilecek metin</label>
            <textarea id="ai-checker-input" ref={inputRef} value={text} maxLength={MAX_LENGTH} disabled={busy}
              onChange={event => setText(event.target.value)}
              onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void analyze(); } }}
              rows={9} aria-describedby="ai-checker-count" spellCheck={false} autoComplete="off" autoCorrect="off"
              placeholder="Analiz etmek istediğin Türkçe veya İngilizce metni buraya yaz veya yapıştır…"
              className="block w-full min-h-52 sm:min-h-64 resize-none sm:resize-y rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/70 p-4 sm:p-5 text-base leading-7 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60"/>
            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span id="ai-checker-count">{wordCount.toLocaleString('tr-TR')} kelime · {text.length.toLocaleString('tr-TR')} / {MAX_LENGTH.toLocaleString('tr-TR')} karakter</span>
              <span className="hidden sm:inline">Ctrl / ⌘ + Enter ile analiz et</span>
            </div>

          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6">
            <button type="button" onClick={reset} disabled={busy}
              className="inline-flex justify-center items-center gap-2 min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              <RotateCcw size={16}/> Yeni analiz
            </button>
            <button type="button" onClick={() => void analyze()} disabled={busy || restoring || !text.trim()}
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
              {submitting ? 'Metin sunucuya iletiliyor.' : 'Uzun metinler birkaç dakika sürebilir. Sayfadan ayrılsan da analiz devam eder.'}
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
                <p className="mt-2 text-xs text-slate-500">{result.model.startsWith('ertoluk/') ? 'Türkçe model · Deneysel · Yerel doğruluk ölçümü bekleniyor' : 'İngilizce model · Desklib'}</p>
              </div>
              <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 min-h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Kopyalandı' : 'Sonucu kopyala'}
              </button>
            </div>
            {result.scores && <details className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-200">Model skorlarını göster</summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                { name: 'İnsan Yazımı', value: human, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
                { name: 'AI Üretimi', value: ai, bar: 'bg-indigo-500', dot: 'bg-indigo-500' },
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
            </details>}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed space-y-2">
              <p>{result.words.toLocaleString('tr-TR')} kelime{result.scores && ` · ${result.segmentAi.length} bölüm değerlendirildi`}</p>
              <p>Skorlar modelin değerlendirmesini gösterir. Düzenlenmiş ve akademik metinlerde tahmin hataları görülebilir.</p>
            </div>
          </div>
        </section>}

        <div className="flex gap-3 rounded-2xl p-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          <LockKeyhole size={19} className="shrink-0 mt-0.5"/>
          <p>Metin sunucu belleğinde işlenir. Sonuç özeti sunucu belleğinde en fazla 30 dakika tutulur.</p>
        </div>
      </div>
    </main>
  );
}
