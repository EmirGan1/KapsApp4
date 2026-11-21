import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, LockKeyhole, Sparkles } from 'lucide-react';
import { germanTokens, wordKey, type QuestionWord } from '../../shared/germanGlossary';
import { germanRequest } from './api';
import type { GermanTask, MistakeExplanationResponse } from './types';

type HelpContext = { words: Map<string, QuestionWord>; reviewed: boolean; open: (token: string, element: HTMLElement) => void; close: () => void; tooltipId: string; active: string | null };
const Context = createContext<HelpContext | null>(null);
export function QuestionVocabularyProvider({ task, sessionId, reviewed, enabled, explanation, onExplain, loading, children }: {
  task: GermanTask; sessionId: string; reviewed: boolean; enabled: boolean; explanation?: MistakeExplanationResponse;
  onExplain: () => void; loading: boolean; children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<{ taskId: string; words: QuestionWord[] }>({ taskId: '', words: [] });
  const [active, setActive] = useState<{ token: string; key: string; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const anchor = useRef<HTMLElement | null>(null);
  const tooltipId = useId();
  useEffect(() => {
    setActive(null);
    if (!enabled || task.module !== 'vocabulary') return;
    const controller = new AbortController();
    void germanRequest<{ words: QuestionWord[] }>(`/sessions/${encodeURIComponent(sessionId)}/words`, { taskId: task.id }, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSnapshot({ taskId: task.id, words: result.words }); }).catch(() => {});
    return () => { controller.abort(); clearTimeout(timer.current); };
  }, [sessionId, task.id, reviewed, enabled]);
  useEffect(() => {
    const dismiss = (event: Event) => { if (!(event.target instanceof Element) || !event.target.closest('[data-word-help]')) setActive(null); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setActive(null); };
    const scroll = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) { setActive(null); return; }
      setActive(previous => previous ? { ...previous, x: Math.max(12, Math.min(window.innerWidth - 272, rect.left)), y: rect.bottom + 130 > window.innerHeight ? Math.max(12, rect.top - 120) : rect.bottom + 8 } : null);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true); window.addEventListener('resize', scroll);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', scroll); };
  }, []);
  const words = useMemo(() => {
    const map = new Map<string, QuestionWord>();
    if (snapshot.taskId === task.id) for (const word of snapshot.words) map.set(wordKey(word.token), word);
    if (reviewed && explanation) for (const word of explanation.wordBreakdown || []) {
      const key = wordKey(word.token); const previous = map.get(key);
      map.set(key, { ...word, meaningTr: previous?.meaningTr && previous.meaningTr !== word.meaningTr && word.meaningTr ? `${previous.meaningTr} / ${word.meaningTr}` : word.meaningTr || previous?.meaningTr || null, locked: false });
    }
    return map;
  }, [snapshot, task.id, reviewed, explanation]);
  const open = (token: string, element: HTMLElement) => {
    clearTimeout(timer.current);
    anchor.current = element;
    const rect = element.getBoundingClientRect();
    setActive({ token, key: wordKey(token), x: Math.max(12, Math.min(window.innerWidth - 272, rect.left)),
      y: rect.bottom + 130 > window.innerHeight ? Math.max(12, rect.top - 120) : rect.bottom + 8 });
  };
  const close = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setActive(null), 140); };
  const word = active ? words.get(active.key) : null;
  const available = [...words.values()].some(w => !w.locked);
  return <Context.Provider value={{ words, reviewed, open, close, tooltipId, active: active?.key || null }}>
    {children}
    {enabled && words.size > 0 && <div className={`kg-word-notice ${reviewed ? 'is-unlocked' : ''}`} role={reviewed ? 'status' : undefined}>
      {reviewed ? <BookOpen size={16} /> : available ? <BookOpen size={16} /> : <LockKeyhole size={15} />}
      <span>{reviewed ? 'Kelime anlamları açıldı · kelimelere dokun' : available ? 'Altı çizili kelimelerin anlamına bakabilirsin' : 'Anlamlar yanıtından sonra açılır'}</span>
      {reviewed && <button type="button" className="kg-btn kg-btn-sm" disabled={loading} onClick={onExplain}><Sparkles size={14} />{loading ? 'Çözümleniyor…' : 'Cümleyi çözümle'}</button>}
      {reviewed && <div className="kg-word-chips">{[...words.values()].map(w => <GermanWordText key={wordKey(w.token)} text={w.token} />)}</div>}
    </div>}
    {word && active && !word.locked && createPortal(<div id={tooltipId} role="tooltip" className="kg kg-word-popover" style={{ left: active.x, top: active.y }}>
      <strong lang="de">{active.token}</strong><span>{word.meaningTr || 'Bu kelimenin bağlamsal anlamı için “Cümleyi çözümle”yi kullan.'}</span>{word.noteTr && <small>{word.noteTr}</small>}
    </div>, document.body)}
  </Context.Provider>;
}
export function GermanWordText({ text }: { text: string }) {
  const help = useContext(Context);
  if (!help) return <>{text}</>;
  const chunks: ReactNode[] = []; let cursor = 0; let index = 0;
  for (const token of germanTokens(text)) {
    const start = text.indexOf(token, cursor);
    chunks.push(text.slice(cursor, start));
    const entry = help.words.get(wordKey(token));
    chunks.push(entry && !entry.locked ? <button key={`${index++}-${start}`} type="button" data-word-help className={`kg-word ${help.reviewed ? 'is-unlocked' : ''}`}
      aria-label={`${token} kelimesinin Türkçe anlamı`} aria-describedby={help.active === wordKey(token) ? help.tooltipId : undefined}
      onPointerEnter={e => { if (e.pointerType === 'mouse') help.open(token, e.currentTarget); }} onPointerLeave={help.close}
      onFocus={e => help.open(token, e.currentTarget)} onBlur={help.close} onClick={e => { e.stopPropagation(); help.open(token, e.currentTarget); }}>{token}</button> : token);
    cursor = start + token.length;
  }
  chunks.push(text.slice(cursor));
  return <>{chunks}</>;
}
