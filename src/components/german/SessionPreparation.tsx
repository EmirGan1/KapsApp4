import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { PREPARATION_STAGES, type PreparationProgress } from '../../shared/germanPreparation';
import type { OnPreparationProgress } from './api';

type Prepare = <T>(operation: (progress: OnPreparationProgress) => Promise<T>, kind?: 'standard' | 'ai') => Promise<T | undefined>;
const PreparationContext = createContext<{ active: boolean; run: Prepare } | null>(null);

function PreparationDialog({ progress }: { progress: PreparationProgress & { receivedAt: number } }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    dialog.current?.showModal();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const elapsed = Math.max(0, progress.elapsedMs + now - progress.receivedAt);
  const remaining = Math.ceil((progress.estimateMs - elapsed) / 1000);
  return createPortal(<dialog ref={dialog} className="kg kg-preparation-dialog" aria-labelledby="kg-preparation-title" aria-describedby="kg-preparation-description" aria-busy="true" onCancel={e => e.preventDefault()}>
    <Loader2 size={36} className="kg-preparation-spinner" aria-hidden="true" />
    <h2 id="kg-preparation-title">Testin oluşturuluyor</h2>
    <p id="kg-preparation-description" aria-live="polite">{PREPARATION_STAGES[progress.stage] || 'Testin hazırlanıyor…'}</p>
    <div className="kg-preparation-track" role="progressbar" aria-label="Test hazırlama aşamaları" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-valuetext={PREPARATION_STAGES[progress.stage]}>
      <div style={{ width: `${progress.percent}%` }} />
    </div>
    <div className="kg-preparation-timing"><strong>Aşama ilerlemesi: %{progress.percent}</strong><span>Geçen süre: {Math.floor(elapsed / 1000)} sn</span></div>
    <p className="kg-preparation-eta">{remaining > 0 ? `Tahmini kalan süre: yaklaşık ${remaining} sn` : 'Beklenenden uzun sürüyor; hazırlık devam ediyor.'}</p>
    <small>Tahmin işlem türüne ve önceki hazırlama sürelerine dayanır. Bu pencere testin hazır olduğunda kapanacak.</small>
  </dialog>, document.body);
}

export function SessionPreparationProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<(PreparationProgress & { receivedAt: number }) | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run: Prepare = useCallback(async (operation, kind = 'standard') => {
    if (running.current) return undefined;
    running.current = true;
    setProgress({ stage: 'accepted', percent: 0, status: 'working', estimateMs: kind === 'ai' ? 40000 : 6000, elapsedMs: 0, receivedAt: Date.now() });
    try {
      const result = await operation(next => {
        if (mounted.current) setProgress(previous => ({ ...next, percent: Math.max(previous?.percent || 0, next.percent), receivedAt: Date.now() }));
      });
      return mounted.current ? result : undefined;
    } finally {
      running.current = false;
      if (mounted.current) setProgress(null);
    }
  }, []);
  return <PreparationContext.Provider value={{ active: progress !== null, run }}>{children}{progress && <PreparationDialog progress={progress} />}</PreparationContext.Provider>;
}
export function useSessionPreparation() {
  const context = useContext(PreparationContext);
  if (!context) throw new Error('SessionPreparationProvider is required');
  return context;
}
