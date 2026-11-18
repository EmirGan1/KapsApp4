import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUp, Check, ChevronDown, Clock3, Copy, FileText, ImagePlus, X, History, LoaderCircle, Plus, RotateCcw, Sparkles, Square, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import {
  AI_MESSAGE_LIMIT, AI_SOURCE_TEXT_LIMIT, KAPSAPP_AI_TURNS_PATH, AI_SOURCE_TITLE_LIMIT, isKapsAiModel, KAPSAPP_AI_MODELS, kapsAiModelLabel, normalizeMathMarkdown,
} from "../shared/kapsAppAi";
import type { ChatSource, ChatStatusPhase } from "../shared/kapsAppAi";
import { getApiUrl, getAuthHeaders } from "../utils/api";
import { prepareKapsAiPhoto } from "../utils/kapsAiPhoto";
import KapsAppAiEquation from "./KapsAppAiEquation";
import { useKapsAiHistory } from "./useKapsAiHistory";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold outline-offset-2 transition-colors";
const secondary = `${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`;
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const headerButton = "max-sm:gap-1 max-sm:px-2 max-sm:text-xs";
const MATH_PLUGINS = [remarkMath];

function extractText(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  return "";
}

const MathMarkdown = memo(function MathMarkdown({
  content,
  streaming = false,
  className,
}: {
  content: string;
  streaming?: boolean;
  className?: string;
}) {
  const normalized = useMemo(() => normalizeMathMarkdown(content, streaming), [content, streaming]);
  return (
    <div className={className}>
      <Markdown
        skipHtml
        remarkPlugins={MATH_PLUGINS}
        components={{
          code: ({ children, className: codeClass }) => {
            const text = extractText(children).replace(/\n$/, "");
            if (codeClass?.split(" ").includes("math-inline") && text) {
              return <KapsAppAiEquation expression={text} />;
            }
            if (codeClass?.split(" ").includes("language-math") && text) {
              return <KapsAppAiEquation expression={text} displayMode />;
            }
            return <code className={codeClass}>{children}</code>;
          },
          pre: ({ node, children }) => {
            const code = node?.children[0];
            if (
              code?.type === "element" &&
              code.tagName === "code" &&
              Array.isArray(code.properties.className) &&
              code.properties.className.includes("language-math")
            ) {
              const raw = code.children
                .map(child => (child.type === "text" ? child.value : ""))
                .join("")
                .trim();
              if (raw) return <KapsAppAiEquation expression={raw} displayMode />;
            }
            return <pre>{children}</pre>;
          },
          img: ({ alt }) => (alt ? <span>{alt}</span> : null),
          a: ({ children }) => <span className="text-violet-700 dark:text-violet-300">{children}</span>,
        }}
      >
        {normalized}
      </Markdown>
    </div>
  );
});

const Answer = memo(function Answer({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <MathMarkdown
      content={content}
      streaming={streaming}
      className="min-w-0 break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 [&_p+p]:mt-3 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:list-decimal [&_li]:ml-5 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:text-sm [&_pre]:text-slate-100 [&_p>code]:rounded [&_p>code]:bg-slate-200/70 [&_p>code]:px-1 dark:[&_p>code]:bg-slate-700 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400 [&_blockquote]:pl-3"
    />
  );
});

const UserQuestion = memo(function UserQuestion({ content }: { content: string }) {
  const hasMathOrMarkdown = /[$\\`*_#\[~]/.test(content);
  if (!hasMathOrMarkdown) {
    return (
      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-violet-50 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:bg-violet-950/70 dark:text-white">
        {content}
      </p>
    );
  }
  return (
    <MathMarkdown
      content={content}
      className="min-w-0 break-words rounded-2xl rounded-tr-md bg-violet-50 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:bg-violet-950/70 dark:text-white [&_p+p]:mt-2.5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-2.5 [&_pre]:text-xs [&_pre]:text-slate-100 [&_.katex-display]:my-1.5 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden"
    />
  );
});

function WaitingStatus({ phase, queuePosition }: { phase?: ChatStatusPhase; queuePosition?: number }) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  let stageTitle = "İstek alındı";
  let stageDetail = "Yanıt hazırlanıyor…";
  if (phase === "queued") {
    stageTitle = queuePosition && queuePosition > 1 ? `Sırada bekleniyor (${queuePosition}. sıra)` : "Sırada bekleniyor";
    stageDetail = "Önceki işlem tamamlandığında yanıt hazırlanıyor…";
  } else if (phase === "loading_model") {
    stageTitle = "Model hazırlanıyor";
    stageDetail = "Yerel model belleğe yükleniyor, yanıt hazırlanıyor…";
  } else if (phase === "processing_prompt") {
    stageTitle = "Sorunuz işleniyor";
    stageDetail = "Matematiksel adımlar ve bağlam inceleniyor, yanıt hazırlanıyor…";
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1.5 py-0.5 text-sm text-slate-600 dark:text-slate-300">
      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
        <LoaderCircle size={16} className="shrink-0 animate-spin text-violet-600 dark:text-violet-400" />
        <span>{stageTitle}</span>
        {elapsedSec >= 3 && (
          <span className="text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400">
            · {elapsedSec} sn
          </span>
        )}
      </div>
      <p className="pl-6 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {stageDetail}
      </p>
    </div>
  );
}

function CopyMessage({ content, label }: { content: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timeout = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [state]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" aria-label={label} title={label} className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700" onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setState("copied");
        } catch {
          setState("failed");
        }
      }}>
        {state === "copied" ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span role="status" className="text-xs text-slate-500 dark:text-slate-400">
        {state === "copied" ? "Kopyalandı" : state === "failed" ? "Kopyalanamadı" : ""}
      </span>
    </div>
  );
}

function SavedPhoto({ id, imageHash, active, onLoad }: { id: string; imageHash: string; active: boolean; onLoad: () => void }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let objectUrl = "";
    let disposed = false;
    setUrl("");
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch(getApiUrl(`${KAPSAPP_AI_TURNS_PATH}/${id}/image`), {
          headers: getAuthHeaders(), cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Photo unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, imageHash, active, attempt]);
  if (failed) return <button type="button" className={secondary} onClick={() => setAttempt(value => value + 1)}>Fotoğrafı tekrar yükle</button>;
  if (!url) return <p className="p-3 text-xs text-slate-500" role="status">Fotoğraf yükleniyor…</p>;
  return <a href={url} target="_blank" rel="noreferrer" aria-label="Fotoğrafı büyük aç" className="mb-2 block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
    <img src={url} onLoad={onLoad} alt="Gönderdiğin fotoğraf" className="max-h-80 w-full object-contain" />
  </a>;
}

function ResponseDuration({ milliseconds }: { milliseconds: number }) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const label = milliseconds < 1000 ? "1 sn'den az"
    : minutes > 0 ? `${minutes} dk ${seconds % 60} sn` : `${seconds} sn`;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
      <Clock3 size={14} aria-hidden="true" />
      Yanıt süresi <time dateTime={`PT${milliseconds / 1000}S`}>{label}</time>
    </span>
  );
}

export default function KapsAppAi({ active = true }: { active?: boolean } = {}) {
  const history = useKapsAiHistory(active);
  const { turns, conversationId, activeTurn, pendingSubmission, acceptedSubmission, actionPending } = history;
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const photoVersion = useRef(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [source, setSource] = useState<ChatSource>({ title: "", text: "" });
  const [jumpVisible, setJumpVisible] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const running = activeTurn?.conversationId === conversationId ? activeTurn : null;
  const hasSource = Boolean(source.title.trim() || source.text.trim());
  const sourceValid = !hasSource || Boolean(source.title.trim() && source.text.trim());
  const sendingBlocked = !history.initialized || history.loading || history.modelPending || Boolean(activeTurn || pendingSubmission || actionPending);

  function clearPhoto() {
    photoVersion.current++;
    setPhoto(undefined);
    setPhotoBusy(false);
    setPhotoError("");
  }

  async function attachPhoto(file: File) {
    const version = ++photoVersion.current;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const prepared = await prepareKapsAiPhoto(file);
      if (version === photoVersion.current) setPhoto(prepared);
    } catch (error) {
      if (version === photoVersion.current) setPhotoError(error instanceof Error ? error.message : "Fotoğraf hazırlanamadı.");
    } finally {
      if (version === photoVersion.current) setPhotoBusy(false);
    }
  }

  function scrollToBottom() {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }

  useLayoutEffect(() => {
    if (active && stickToBottom.current) scrollToBottom();
  }, [turns, sourceOpen, active]);

  useEffect(() => {
    if (!scroller.current) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom();
    });
    observer.observe(scroller.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!acceptedSubmission) return;
    if (acceptedSubmission.image) {
      setPhoto(previous => previous === acceptedSubmission.image ? undefined : previous);
    }
    setDraft(previous => previous.trim() === acceptedSubmission.question ? "" : previous);
    if (acceptedSubmission.source) {
      const sent = acceptedSubmission.source;
      setSource(previous => previous.title.trim() === sent.title && previous.text.trim() === sent.text
        ? { title: "", text: "" } : previous);
      setSourceOpen(false);
    }
  }, [acceptedSubmission]);

  function select(id: string | null) {
    if (pendingSubmission || actionPending) return;
    stickToBottom.current = true;
    setJumpVisible(false);
    setHistoryOpen(false);
    setDeleting(null);
    setDraft("");
    clearPhoto();
    setSource({ title: "", text: "" });
    setSourceOpen(false);
    void history.open(id);
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    const question = draft.trim() || (photo ? "Bu fotoğrafı açıkla. Okuyamadığın yazıları belirt." : "");
    if (!question || photoBusy || !sourceValid || sendingBlocked) return;
    const attached = hasSource ? { title: source.title.trim(), text: source.text.trim() } : undefined;
    stickToBottom.current = true;
    setJumpVisible(false);
    void history.send(question, attached, photo);
  }

  return (
    <section hidden={!active} aria-label="KapsAI" className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <header className="z-10 shrink-0 border-b border-violet-100/80 bg-white/95 dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-violet-500 to-indigo-800 text-white shadow-sm shadow-violet-800/25">
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <h2 className="truncate text-base font-bold tracking-tight text-slate-950 dark:text-white">KapsAI</h2>
          </div>
          <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-2.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <div className="relative shrink-0">
              <select aria-label="KapsAI modeli" aria-describedby="kaps-ai-model-description"
                className="min-h-11 max-w-full appearance-none rounded-xl border border-violet-200 bg-violet-50 py-2 pl-3 pr-9 text-sm font-semibold text-violet-950 outline-offset-2 disabled:opacity-50 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-100"
                value={history.model}
                disabled={!history.initialized || history.modelPending || Boolean(pendingSubmission)}
                onChange={event => {
                  const next = event.currentTarget.value;
                  if (isKapsAiModel(next)) void history.chooseModel(next);
                }}>
                {Object.entries(KAPSAPP_AI_MODELS).map(([id, info]) => (
                  <option key={id} value={id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{info.label}</option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-violet-700 dark:text-violet-300" />
            </div>
            <p id="kaps-ai-model-description" title={KAPSAPP_AI_MODELS[history.model].description} className="text-xs leading-tight text-slate-600 dark:text-slate-400">
              {KAPSAPP_AI_MODELS[history.model].profile}
            </p>
          </div>
          <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-1.5 sm:col-start-3 sm:gap-2">
            <button type="button" className={`${secondary} ${headerButton}`} aria-expanded={historyOpen} aria-controls="kaps-ai-history"
              disabled={Boolean(pendingSubmission)} onClick={() => setHistoryOpen(open => !open)}>
              <History size={16} /> Geçmiş
            </button>
            <button type="button" className={`${button} ${headerButton} bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200`} disabled={Boolean(pendingSubmission || actionPending)} onClick={() => select(null)}>
              <Plus size={16} /> Yeni sohbet
            </button>
          </div>
        </div>
      </header>

      {historyOpen && <section id="kaps-ai-history" aria-label="Sohbet geçmişi" className="max-h-[42dvh] shrink-0 overflow-y-auto border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-4xl space-y-1 px-3 py-2 sm:px-6">
          {history.conversations.length === 0 && <p className="py-2 text-sm text-slate-500">Kayıtlı sohbet yok.</p>}
          {history.conversations.map(chat => (
            <div key={chat.id} className="flex min-w-0 flex-wrap items-center gap-2">
              <button type="button" aria-current={chat.id === conversationId ? "true" : undefined}
                className={`${secondary} min-w-0 flex-1 justify-start`} onClick={() => select(chat.id)}>
                <span className="truncate">{chat.title}</span>
                {activeTurn?.conversationId === chat.id && <LoaderCircle className="shrink-0 animate-spin" size={15} />}
              </button>
              <button type="button" className={secondary} aria-label={`Sohbeti sil: ${chat.title}`}
                disabled={actionPending || activeTurn?.conversationId === chat.id} onClick={() => setDeleting(chat.id)}>
                <Trash2 size={16} />
              </button>
              {deleting === chat.id && <div className="flex w-full flex-wrap items-center gap-2 p-2 text-sm">
                <span>Bu sohbeti silmek istiyor musun?</span>
                <button type="button" className={secondary} disabled={actionPending} onClick={() => {
                  setDeleting(null);
                  void history.remove(chat.id);
                }}>Sil</button>
                <button type="button" className={secondary} onClick={() => setDeleting(null)}>Vazgeç</button>
              </div>}
            </div>
          ))}
          {history.listNext && <button type="button" className={secondary} disabled={actionPending} onClick={() => void history.moreChats()}>Daha eski sohbetler</button>}
        </div>
      </section>}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} aria-label="Sohbet mesajları" tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-offset-[-2px] [overflow-anchor:none]" onScroll={event => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setJumpVisible(!stickToBottom.current);
        }}>
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-3 py-5 sm:px-6 sm:py-8">
            {history.turnNext && <button type="button" className={`${secondary} mb-4 self-center`} disabled={actionPending} onClick={() => {
              stickToBottom.current = false;
              void history.moreTurns();
            }}>Daha eski mesajlar</button>}
            {history.loading && <p role="status" className="m-auto text-sm text-slate-500">Sohbet yükleniyor…</p>}
            {!history.loading && turns.length === 0 && (
              <div className="mx-auto my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-violet-100 bg-[radial-gradient(ellipse_at_top,#ede9fe,transparent_65%),linear-gradient(#fff,#fff)] px-4 pb-5 pt-6 shadow-sm dark:border-violet-400/20 dark:bg-[radial-gradient(ellipse_at_top,#262046,transparent_65%),linear-gradient(#101323,#101323)] sm:px-8 sm:pb-8 sm:pt-9">
                <div className="text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/25">
                    <Sparkles size={23} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Bugün ne konuşalım?</h3>
                </div>
                <div role="group" aria-label="Bir model seç" className="mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-3">
                  {Object.entries(KAPSAPP_AI_MODELS).map(([id, info]) => {
                    const selected = history.model === id;
                    return (
                      <button key={id} type="button" aria-pressed={selected}
                        disabled={!history.initialized || history.modelPending || Boolean(pendingSubmission)}
                        className={`relative min-w-0 rounded-xl border p-2.5 text-left outline-offset-2 transition-colors disabled:opacity-60 sm:p-3.5 ${selected
                          ? "border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-400/15"
                          : "border-slate-200 bg-white/80 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-slate-950/60 dark:hover:bg-violet-400/10"}`}
                        onClick={() => { if (!selected && isKapsAiModel(id)) void history.chooseModel(id); }}>
                        <span className="block pr-4 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{info.profile}</span>
                        {selected && <Check size={15} aria-hidden="true" className="absolute right-2.5 top-2.5 text-violet-700 dark:text-violet-200 sm:right-3.5 sm:top-3.5" />}
                        <span className="mt-0.5 block text-sm font-bold text-slate-950 dark:text-white">{info.label}</span>
                        <span className="mt-1 block text-xs leading-snug text-slate-600 dark:text-slate-400">{info.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {turns.map(turn => (
              <div key={turn.id} className="mb-5 flex min-w-0 flex-col gap-2.5 sm:mb-7">
                <article aria-label="Senin mesajın" className="min-w-0 max-w-[92%] self-end sm:max-w-[80%]">
                  {turn.imageHash && <SavedPhoto id={turn.id} imageHash={turn.imageHash} active={active} onLoad={() => { if (stickToBottom.current) scrollToBottom(); }} />}
                  <UserQuestion content={turn.question} />
                  <div className="flex justify-end"><CopyMessage content={turn.question} label="Mesajı kopyala" /></div>
                </article>
                <article aria-label="KapsAI yanıtı" className="flex min-w-0 items-start gap-2 sm:gap-3">
                  <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl border border-violet-100 text-violet-700 dark:border-violet-900 dark:text-violet-300"><Sparkles size={16} /></span>
                  <div className="min-w-0 flex-1 rounded-[22px] rounded-tl-md border border-slate-200/90 bg-white px-3 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:px-5 sm:py-4">
                    <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                      {kapsAiModelLabel(turn.model)}
                    </p>
                    {turn.state === "waiting" && (
                      <WaitingStatus phase={turn.phase} />
                    )}
                    {turn.answer && <Answer content={turn.answer} streaming={turn.state === "streaming"} />}
                    {turn.notice && <p role={turn.state === "error" ? "alert" : "status"} className={`text-sm ${turn.answer ? "mt-2" : ""} ${turn.state === "error" ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}>{turn.notice}</p>}
                    {turn.sources.length > 0 && (
                      <div className="mt-3 break-words border-t border-slate-200 pt-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <p className="font-semibold">Eklediğin kaynak</p>
                        <ul className="mt-1">{turn.sources.map(item => <li key={item.id}>[{item.id}] {item.title}</li>)}</ul>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {turn.state === "done" && turn.generationMs !== undefined && <ResponseDuration milliseconds={turn.generationMs} />}
                      {turn.answer && turn.state !== "streaming" && <CopyMessage content={turn.answer} label="Yanıtı kopyala" />}
                      {(turn.state === "error" || turn.state === "stopped") && !activeTurn && turn.id === turns.at(-1)?.id && (
                        <button
                          type="button"
                          aria-label="Yanıtı yeniden dene"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          disabled={actionPending}
                          onClick={() => void history.retry(turn.id)}
                        >
                          <RotateCcw size={13} /> Yeniden dene
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
        {jumpVisible && <button type="button" className={`${secondary} absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap shadow-sm`} onClick={() => {
          stickToBottom.current = true;
          scrollToBottom();
          setJumpVisible(false);
        }}><ChevronDown size={16} /> En alta git</button>}
      </div>

      <form onSubmit={send} className="kaps-chat-composer shrink-0 border-t border-slate-200/70 bg-white dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-4xl px-3 pb-2 pt-2 sm:px-6 sm:py-3">
          {photoError && <p role="alert" className="mb-2 text-sm text-rose-700 dark:text-rose-300">{photoError}</p>}
          {(history.error || history.connectionNotice) && <div className="mb-2 space-y-1 text-sm">
            {history.error && <p role="alert" className="text-rose-700 dark:text-rose-300">{history.error}</p>}
            {history.connectionNotice && <p role="status" className="text-slate-600 dark:text-slate-300">{history.connectionNotice}</p>}
            {!history.initialized && history.error && <button type="button" className={secondary} onClick={() => void history.refresh().catch(() => {})}>Tekrar yükle</button>}
          </div>}
          {activeTurn && !running && <button type="button" className={`${secondary} mb-2`} onClick={() => select(activeTurn.conversationId)}>Devam eden yanıta git</button>}
          {sourceOpen && (
            <div id="kaps-ai-source" className="mb-2 max-h-[28dvh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
              <input className={field} data-chat-composer aria-label="Kaynak başlığı" placeholder="Kaynak başlığı" maxLength={AI_SOURCE_TITLE_LIMIT} value={source.title} onChange={event => setSource({ ...source, title: event.target.value })} />
              <textarea className={`${field} block resize-none`} aria-label="Kaynak metni" placeholder="İlgili kaynak metnini yapıştır" rows={2} maxLength={AI_SOURCE_TEXT_LIMIT} value={source.text} onChange={event => setSource({ ...source, text: event.target.value })} />
            </div>
          )}
          {photo && <div className="mb-2 flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-2 dark:border-violet-900 dark:bg-violet-950/30">
            <img src={photo} alt="Fotoğraf önizlemesi" className="size-16 rounded-lg object-contain" />
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <p className="font-semibold">Gemma 4 ile görsel analiz</p>
              <p>Fotoğraf sohbet geçmişine kaydedilir.</p>
            </div>
            <button type="button" aria-label="Fotoğrafı kaldır" className={secondary} disabled={Boolean(pendingSubmission)} onClick={clearPhoto}><X size={16} /></button>
          </div>}
          <input ref={photoInput} type="file" accept="image/*" aria-label="Fotoğraf dosyası" className="sr-only"
            disabled={sendingBlocked || photoBusy} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void attachPhoto(file);
            }} />
          <div className="flex items-end gap-2 rounded-[20px] border border-slate-200 bg-slate-50 p-1.5 shadow-sm focus-within:border-violet-400 dark:border-white/10 dark:bg-slate-900">
            <button type="button" className={`${secondary} size-11 shrink-0 !px-0`}
              aria-label="Fotoğraf ekle" title="Fotoğraf ekle" disabled={sendingBlocked || photoBusy}
              onClick={() => photoInput.current?.click()}>
              {photoBusy ? <LoaderCircle size={19} className="animate-spin" /> : <ImagePlus size={19} />}
            </button>
            <button type="button" aria-expanded={sourceOpen} aria-controls={sourceOpen ? "kaps-ai-source" : undefined} aria-label="Kaynak ekle" title="Kaynak ekle" className={`${secondary} size-11 shrink-0 !px-0 ${hasSource ? "border-violet-500 text-violet-700 dark:text-violet-300" : ""}`} onClick={() => setSourceOpen(open => !open)}>
              <FileText size={19} />
            </button>
            <textarea data-chat-composer aria-label="Mesaj yaz" className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-base leading-6 text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
              rows={Math.min(5, Math.max(1, draft.split("\n").length))}
              maxLength={AI_MESSAGE_LIMIT}
              enterKeyHint="send"
              placeholder={photo ? "Fotoğrafla ilgili sorunu yaz…" : "Mesaj veya matematik sorusu yaz…"}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onPaste={event => {
                if (sendingBlocked || photoBusy) return;
                const file = Array.from(event.clipboardData.items).find(item => item.type.startsWith("image/"))?.getAsFile();
                if (file) {
                  event.preventDefault();
                  void attachPhoto(file);
                }
              }}
              onKeyDown={event => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void send();
              }}
            />
            {running ? (
              <button type="button" className={`${secondary} size-11 shrink-0 !px-0`} disabled={actionPending} onClick={() => void history.stop(running.id)} aria-label="Yanıtı durdur" title="Yanıtı durdur"><Square size={17} fill="currentColor" /></button>
            ) : (
              <button type="submit" className={`${button} size-11 shrink-0 !px-0 bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-45`} disabled={sendingBlocked || photoBusy || (!draft.trim() && !photo) || !sourceValid} aria-label="Mesajı gönder" title="Mesajı gönder"><ArrowUp size={21} /></button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {history.model === "groq:openai/gpt-oss-120b" && <span className="mb-1 block text-violet-700 dark:text-violet-300">Bulut modeli: Mesajların ve sohbet bağlamın Groq’a gönderilir. Ücretsiz kota geçerlidir. Fotoğraflar Gemma ile yerel işlenir.</span>}
            {sourceValid ? "Sohbetler hesabına kaydedilir. Ekranı kapatsan da başlayan yanıt sunucuda devam eder." : "Kaynak için hem başlık hem metin gir."}
          </p>
        </div>
      </form>
    </section>
  );
}
